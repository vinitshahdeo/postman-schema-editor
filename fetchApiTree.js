const path = require('path'),
    vscode = require('vscode');

module.exports = {
    PostmanFetchApiProvider: function () {
        let _onDidChangeTreeData = new vscode.EventEmitter();

        return {
            onDidChangeTreeData: _onDidChangeTreeData.event,
            refresh: function () {
                _onDidChangeTreeData.fire();
            },
            getChildren: function (element) {
                return [{
                    label: 'Fetch API from Postman',
                    iconPath: {
                        light: path.join(__filename, '..', 'media', 'download-stroke.svg'),
                        dark: path.join(__filename, '..', 'media', 'download-stroke.svg')
                    },
                    command: {
                        command: "postman-schema-editor.fetchPostmanSchema"
                    }
                }]
            },
            getTreeItem: function (item) {
                return item;
            }

        };
    }
}

