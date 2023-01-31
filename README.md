# babel-plugin-remove-unuse-code
删除无用if判断

In:

```js
if (isWeb){
	console.log(1);
} else {
	console.log(2);
}
```

Out:

```js
console.log(1);
```



删除无用变量

In:

```jsx
import { Text, View, StyleSheet, Image } from 'react-native';
const Index = () => {
    return <Text>test</Text>
}
const st = StyleSheet.create({

})
```

Out:

```jsx
import { Text,StyleSheet } from 'react-native';
const Index = () => {
    return <Text>test</Text>
}
const st = StyleSheet.create({

})
```



删除propTypes

In:

```jsx
import React from 'react';
import PropTypes from 'prop-types';
const Index = () => {
    return 1
}
Index.propTypes = {
    text: PropTypes.string
}
```

Out:

```jsx
import React from 'react';
const Index = () => {
    return 1
}
```

In:

```jsx
import React from 'react';
import PropTypes from 'prop-types';
class App extends React.PureComponent {
    static propTypes = {
        text: PropTypes.string
    }
    render() {
        return null
    }
}
```

Out:

```jsx
import React from 'react';
class App extends React.PureComponent {
    render() {
        return null
    }
}
```



删除console，debugger

In:

```jsx
import React from 'react';
const Index = () => {
    var a = 1;
    console.log(1);
    debugger;
    return 1
}
```

Out:

```jsx
import React from 'react';
const Index = () => {
    var a = 1;
    return 1
}
```



## Install

```shell
npm install --save-dev babel-plugin-remove-unuse-code
```

## Usage

**.babelrc**

```json
{
  "plugins": [
    [
      path."remove-unuse-code",
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
        },
        propTypes: {
          remove: true,
          onlyProduction: false,
        }
      }
    ]
  ]
}
```

