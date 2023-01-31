import {
    unaryExpression,
    numericLiteral,
    isStringLiteral,
    isIdentifier,
    isUnaryExpression,
} from "@babel/types";
import { Options } from "../index";

const traversed: symbol = Symbol("traversed");

export function normalizeOptions(options: Options): void {
    const { imports, styles, propTypes } = options;
    if (!imports.customImports) imports.customImports = [];
    if (!Array.isArray(imports.customImports)) {
        imports.customImports = [imports.customImports];
    }
    if (!imports.ignoreLibraries) imports.ignoreLibraries = ["react"];
    if (!Array.isArray(imports.ignoreLibraries)) {
        imports.ignoreLibraries = [imports.ignoreLibraries];
    }
    imports.ignoreFilenames = imports.ignoreFilenames
        ? new RegExp(arrayToString(imports.ignoreFilenames), "i")
        : "";
    styles.ignoreFilenames = styles.ignoreFilenames
        ? new RegExp(arrayToString(styles.ignoreFilenames), "i")
        : "";
    propTypes.ignoreFilenames = propTypes.ignoreFilenames
        ? new RegExp(arrayToString(propTypes.ignoreFilenames), "i")
        : "";
}

function arrayToString(value: any) {
    if(typeof value === 'object'){
        return value.join('|')
    } else {
        return value
    }
}

export function remove(path: any): void {
    if (path.parentPath.type === "ConditionalExpression") {
        path.replaceWith(unaryExpression("void", numericLiteral(0)));
    } else {
        path.remove();
    }
}

export function isIgnore(scope: any, regex: RegExp): boolean {
    return false;
    const filename: string = scope.hub?.file?.opts?.filename;
    if (!filename) {
        return true;
    }
    if (!regex) {
        return false;
    }
    return (regex as RegExp).test(filename);
}

export function isProptypesRemove(path: any, globalOptions: Options): boolean {
    const { remove, ignoreFilenames, onlyProduction } = globalOptions.propTypes;
    if (!remove || isIgnore(path.scope, ignoreFilenames as RegExp)) {
        return false;
    }
    if (onlyProduction) {
        return process.env.NODE_ENV === "production";
    }
    return true;
}

function toSnakeCase(key: string) {
    return key.replace(/[a-z][A-Z]/g, (s) => s[0] + "_" + s[1]).toUpperCase();
}

function getParam(key: string, state: any): boolean {
    let keyS = toSnakeCase(key);

    let result = state.opts.var[keyS];
    if (state.opts.var.hasOwnProperty(key)) {
        result = state.opts.var[key];
    }

    if (process.env[keyS] !== undefined) {
        result = process.env[keyS];
    }

    if (
        result === "true" ||
        result === true ||
        result === "1" ||
        result === 1
    ) {
        return true;
    }

    if (
        result === "false" ||
        result === false ||
        result === "0" ||
        result === 0
    ) {
        return false;
    }

    return false;
}

export function check(node: any, state: any): boolean {
    if (isStringLiteral(node)) {
        return getParam(node.value, state);
    }
    if (isIdentifier(node)) {
        return getParam(node.name, state);
    }

    // if (isLogicalExpression(node)) {
    //     return getParam(node.left.name, state);
    // }

    if (isUnaryExpression(node) && node.operator == "!") {
        let r = check(node.argument, state);
        return r === undefined ? r : !r;
    }
    return false;
}

export function isRelease(state: any): boolean {
    return (
        state.opts.isRelease ||
        process.env.IS_RELEASE ||
        /release|production/gi.test(process.env.ENV || "")
    );
}

function isJSXElementOrReactCreateElement(path: any): boolean {
    let visited: boolean = false;
    path.traverse({
        CallExpression(path2:any) {
            const callee = path2.get("callee");
            if (
                callee.matchesPattern("React.createElement") ||
                callee.matchesPattern("React.cloneElement") ||
                callee.node.name === "cloneElement"
            ) {
                visited = true;
            }
        },
        JSXElement() {
            visited = true;
        },
    });
    return visited;
}

function isReturningJSXElement(path: any, iteration: number = 0): boolean {
    // Early exit for ArrowFunctionExpressions, there is no ReturnStatement node.
    if (
        path.node.init &&
        path.node.init.body &&
        isJSXElementOrReactCreateElement(path)
    ) {
        return true;
    }

    if (iteration > 20) {
        throw new Error(
            "transform-react-remove-prop-type: infinite loop detected."
        );
    }

    let visited: boolean = false;

    path.traverse({
        ReturnStatement(path2: any) {
            // We have already found what we are looking for.
            if (visited) {
                return;
            }
            const argument = path2.get("argument");
            // Nothing is returned
            if (!argument.node) {
                return;
            }
            if (isJSXElementOrReactCreateElement(path2)) {
                visited = true;
                return;
            }
            if (argument.node.type === "CallExpression") {
                const name = argument.get("callee").node.name;
                const binding = path.scope.getBinding(name);
                if (!binding) {
                    return;
                }
                // Prevents infinite traverse loop.
                if (binding.path[traversed]) {
                    return;
                }
                binding.path[traversed] = true;
                if (isReturningJSXElement(binding.path, iteration + 1)) {
                    visited = true;
                }
            }
        },
    });

    return visited;
}

const VALID_POSSIBLE_STATELESS_COMPONENT_TYPES = [
    "VariableDeclarator",
    "FunctionDeclaration",
];

// Returns `true` if the path represents a function which returns a JSXElement
export function isStatelessComponent(path: any): boolean {
    if (
        VALID_POSSIBLE_STATELESS_COMPONENT_TYPES.indexOf(path.node.type) === -1
    ) {
        return false;
    }
    if (isReturningJSXElement(path)) {
        return true;
    }
    return false;
}

function isPathReactClass(path: any): boolean {
    const node = path.node;
    if (
        path.matchesPattern("React.Component") ||
        path.matchesPattern("React.PureComponent")
    ) {
        return true;
    }
    if (node && (node.name === "Component" || node.name === "PureComponent")) {
        return true;
    }
    return false;
}

export function isReactClass(superClass: any, scope: any): boolean {
    if (!superClass.node) {
        return false;
    }
    let answer: boolean = false;
    if (isPathReactClass(superClass)) {
        answer = true;
    } else if (superClass.node.name) {
        // Check for inheritance
        const className: string = superClass.node.name;
        const binding = scope.getBinding(className);
        if (!binding) {
            answer = false;
        } else {
            const bindingSuperClass = binding.path.get("superClass");
            if (isPathReactClass(bindingSuperClass)) {
                answer = true;
            }
        }
    }
    return answer;
}
