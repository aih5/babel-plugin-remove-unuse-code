let path = require("path");
let babel = require("@babel/core");

const code = `
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Text, View, StyleSheet, Image } from 'react-native';
const Index = ({text}) => {
    var a = 1;
    debugger;
    if (isWeb){
        console.log(1);
    } else {
        console.log(2);
    }
    return <Text>{text}</Text>
}
class App extends PureComponent {
    static propTypes = {
        text: PropTypes.string
    }
    render() {
        return <Text>{this.props.text}</Text>
    }
}
const st = StyleSheet.create({

})
Index.propTypes = {
    text: PropTypes.string
}
`;

const result = babel.transform(code, {
    presets: ["@babel/preset-react"],
    plugins: [
        [
            path.resolve("lib/index.js"),
            {
                isRelease: true,
                var: {
                    isWeb: true,
                    isAndroid: false,
                    isIOS: false,
                },
                imports: {
                    ignoreLibraries: ["react"],
                    remove: true,
                    customImports: {
                        libraryName: "antd",
                        libraryDirectory: "lib",
                        customMapping: {
                            Button: "customPath/Button",
                        },
                    },
                },
                propTypes: {
                    remove: true,
                    onlyProduction: false,
                },
            },
        ],
    ],
});

console.log(result.code);
