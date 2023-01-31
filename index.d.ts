export type Import = {
    libraryName: string,
    libraryDirectory?: string,
    customMapping?: {
        [key: string]: string
    }
}

export type Options = {
    isRelease: boolean,
    var: {
        [key: string]: string
    },
    imports: {
        ignoreLibraries?: string[],
        ignoreFilenames?: string[] | string | RegExp,
        remove?: boolean,
        customImports?: Array<Import>
    },
    styles: {
        ignoreFilenames?: string[] | string | RegExp,
        remove?: boolean,
    },
    propTypes: {
        ignoreFilenames?: string[] | string | RegExp,
        remove?: boolean,
        onlyProduction?: boolean
    }
}