import {
    Node,
    stringLiteral,
    isImportSpecifier,
    isBlockStatement,
    importDeclaration,
    importDefaultSpecifier,
    ImportSpecifier,
    ImportDeclaration
} from '@babel/types';
import { Options } from '../index';
import {
    normalizeOptions,
    isRelease,
    check,
    remove,
    isIgnore,
    isReactClass,
    isStatelessComponent,
    isProptypesRemove
} from './util';

export default () => {
    const defaultOptions: Options = {
        isRelease: true,
        var: {},
        imports: {
            ignoreLibraries: ['react'],
            ignoreFilenames: '',
            remove: true,
            customImports: [],
        },
        styles: {
            ignoreFilenames: '',
            remove: true,
        },
        propTypes: {
            ignoreFilenames: '',
            remove: true,
            onlyProduction: true,
        }
    };
    let globalOptions: Options;
    const reDevVar = /^(console|logger|debug)$/;

    return {
        name: "remove-unuse-code",
        visitor: {
            Program(programPath:any, state:any) {
                // 初始化参数
                if (!globalOptions) {
                    const options: Options = state.opts;
                    globalOptions = Object.assign({}, defaultOptions, options) as Options;
                    normalizeOptions(globalOptions);
                }
            },
            // 删除debugger
            DebuggerStatement(path:any, state:any) {
                if (isRelease(state)) {
                    path.remove();
                }
            },
            Identifier(path:any, state:any) {
                if (isRelease(state) && reDevVar.test(path.node.name)) {
                    path.getStatementParent().remove();
                }
            },
            IfStatement(path:any, state:any) {
                const { node } = path;
                let cr = check(node.test, state);
                if (cr === undefined) return;

                let result = cr ? node.consequent : node.alternate;
                if (!result) {
                    path.remove();
                } else if (isBlockStatement(result)) {
                    path.replaceWithMultiple(result.body);
                } else {
                    path.replaceWith(result);
                }
            },
            ConditionalExpression(path:any, state:any) {
                const { node } = path;
                let cr = check(node.test, state);
                if (cr === undefined) {
                    return;
                }
                path.replaceWith(cr ? node.consequent : node.alternate);
            },
            /* 
             * 1、删除无用模块
             * 2、按需加载
             * 3、删除propTypes
            */
            ImportDeclaration(path:any) {
                const { node, scope } = path;
                const specifiers: ImportSpecifier[] = node.specifiers;
                const sourceValue: string = node.source.value;
                const imports: Record<string, any> = globalOptions.imports;
                if (isIgnore(path.scope, globalOptions.imports.ignoreFilenames as RegExp)) {
                    return;
                }
                // 删除无用模块
                if (imports.remove) {
                    for (let i = specifiers.length - 1; i >= 0; i--) {
                        const name: string = specifiers[i].local.name;
                        const binding = scope.getBinding(name);
                        if (binding?.referencePaths?.length === 0 && !imports.ignoreLibraries.includes(sourceValue)) {
                            remove(binding.path);
                        }
                        if (specifiers.length === 0) {
                            remove(path);
                        }
                    }
                }
                // 按需加载
                if (imports.customImports.length) {
                    const customImport = imports.customImports.find((imports:any) => imports.libraryName === sourceValue);
                    if (customImport && isImportSpecifier(specifiers[0])) {
                        const newImports: ImportDeclaration[] = specifiers.map(specifier => {
                            const localName: string = specifier.local.name;
                            const customUrl: string = customImport.customMapping?.[localName] ?? `${customImport.libraryDirectory ?? 'lib'}/${localName}`;
                            return (
                                importDeclaration([importDefaultSpecifier(specifier.local)],
                                    stringLiteral(`${customImport.libraryName}/${customUrl}`))
                            )
                        });
                        path.replaceWithMultiple(newImports);
                    }
                }
                // 删除propTypes模块
                if (isProptypesRemove(path, globalOptions)) {
                    if(sourceValue === 'prop-types'){
                        remove(path);
                    }
                }
            },
            /* 
             * 删除class类中propTypes
             * static propTypes = {
             *     text: PropTypes.string
             * }
            */
            ClassProperty(path:any) {
                if (!isProptypesRemove(path, globalOptions)) {
                    return;
                }
                const { node, scope } = path;
                if (node.key?.name === 'propTypes') {
                    const pathClassDeclaration = scope.path;
                    if (isReactClass(pathClassDeclaration.get('superClass'), scope)) {
                        remove(path);
                    }
                }
            },
            /* 
             * 删除构造函数上propTypes
             * Index.propTypes = {
             *     text: PropTypes.string
             * };
            */
            AssignmentExpression(path:any) {
                if (!isProptypesRemove(path, globalOptions)) {
                    return;
                }
                const { node, scope } = path;
                if (node.left.computed || !node.left.property || node.left.property.name !== 'propTypes') {
                    return;
                }
                const className: string = node.left.object.name;
                const binding = scope.getBinding(className);
                if (!binding) {
                    return;
                }
                if (binding.path.isClassDeclaration()) {
                    const superClass = binding.path.get('superClass');
                    if (isReactClass(superClass, scope)) {
                        remove(path);
                    }
                } else if (isStatelessComponent(binding.path)) {
                    remove(path);
                }
            },
            // IfStatement(path, state) {
            //     console.log(1)
            //     // 删除整个表达式
            //     // if (
            //     //     path.node.test.type === "Identifier" &&
            //     //     path.node.test.name === "isWeb"
            //     // ) {
            //     //     path.remove();
            //     // }
            //     // console.log(path.node)
            //     let consequent_path = path.get("consequent");
            //     let alternate_path = path.get("alternate");
            //     let test_path = path.get("test");
            //     let { name } = state.opts || {};


            //     let replace_path;
            //     let confident = test_path.isIdentifier({ name });
            //     // console.log(confident);

            //     if (confident) {
            //         // if (!t.isBlockStatement(consequent_path)) {
            //         //     consequent_path.replaceWith(
            //         //         t.blockStatement([consequent_path])
            //         //     );
            //         // }
            //         // console.log('alternate_path', alternate_path)

            //         // if (
            //         //     alternate_path &&
            //         //     !t.isBlockStatement(alternate_path)
            //         // ) {
            //         //     alternate_path.replaceWith(
            //         //         t.blockStatement([alternate_path])
            //         //     );
            //         // }

            //         // let { confident, value } = test_path.evaluate();
            //         if (!alternate_path) {
            //             path.remove();
            //             path.scope.crawl();
            //             return;
            //         }
            //         // replace_path = alternate_path;
            //     } else {
            //         // if (test_path.get("left").isIdentifier({ name })) {
            //         //     if (!alternate_path) {
            //         //         path.remove();
            //         //         path.scope.crawl();
            //         //         return;
            //         //     } else {
            //         //         replace_path = alternate_path;
            //         //     }
            //         // } else {
            //         //     replace_path = consequent_path;
            //         // }
            //     }

            //     if (replace_path) {
            //         for (let statement of replace_path.node.body) {
            //             if (
            //                 t.isVariableDeclaration(statement) &&
            //                 statement.kind !== "var"
            //             ) {
            //                 return;
            //             }
            //         }
            //         path.replaceWithMultiple(replace_path.node.body);
            //         path.scope.crawl();
            //     }
            // },
            // ExpressionStatement: (path) => {
            //     if (path.node.expression.type === "LogicalExpression") {
            //         if (
            //             path.node.expression.left.type === "Identifier" &&
            //             path.node.expression.left.name === "isWeb"
            //         ) {
            //             path.remove();
            //         }
            //     }
            // },
        },
    };
};
