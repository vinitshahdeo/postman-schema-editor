const utils = require('./utils'),
    path = require('path'),
    vscode = require('vscode');

module.exports = {
    PostmanApiProvider: function (context) {
        let _onDidChangeTreeData = new vscode.EventEmitter();

        return {
            onDidChangeTreeData: _onDidChangeTreeData.event,
            refresh: function () {
                _onDidChangeTreeData.fire();
            },
            getChildren: function (element) {
                // context.workspaceState.
                if (!element) {
                    return JSON.parse(context.workspaceState.get("postmanSchemaFetch.ws", "[]"));
                } else {
                    // utils.showError(JSON.stringify(element));
                    // utils.showError(context.workspaceState.get(element.id, "[]"));
                    return JSON.parse(context.workspaceState.get(element.id, "[]"));
                }
            },
            getTreeItem: function (item) {
                item['contextValue'] = item['type'];
                if (item['type'] == 'apiVersion') {
                    item['collapsibleState'] = 0;
                    let command = {
                        command: 'postman-schema-editor.openSchemaVersion',
                        title: '',
                        arguments: [item['id']]
                    };
                    item['command'] = command;

                } else if (item['type'] == 'api') {
                    item['collapsibleState'] = 1;
                    iconPath = {
                        'light': path.join(__filename, '..', 'media', 'api-stroke.svg'),
                        'dark': path.join(__filename, '..', 'media', 'api-stroke.svg')
                    };
                    item['iconPath'] = iconPath;
                } else {
                    item['collapsibleState'] = 1;
                    iconPath = {
                        'light': path.join(__filename, '..', 'media', 'workspaces-stroke.svg'),
                        'dark': path.join(__filename, '..', 'media', 'workspaces-stroke.svg')
                    };
                    item['iconPath'] = iconPath;
                }

                return item;
            }

        };
    }
}

