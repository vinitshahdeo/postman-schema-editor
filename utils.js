const request = require('request'),
  vscode = require('vscode'),
  POSTMAN_API_URL = 'https://api.getpostman.com';
module.exports = {
  /**
   * Fetches all the workspaces of a user
   * 
   * @param {String} apiKey - API key to be used to authenticate the postman API
   * @param {function} cb - the callback function, called with (error, results)
   */
  getWorkspaces: function (apiKey, cb) {
    let options = {
      'method': 'GET',
      'url': `${POSTMAN_API_URL}/workspaces`,
      'headers': {
        'X-Api-Key': apiKey
      }
    };

    request(options, function (err, response) {
      if (err) {
        return cb(err);
      }
      let workspaces = JSON.parse(response.body).workspaces;
      if (!workspaces) {
        return cb(null, []);
      }

      workspaces = workspaces.map((ws) => {
        ws.label = ws.name;
        ws.description = ws.type
        return ws;
      });

      return cb(null, workspaces);
    });
  },

  /**
   * Fetches all the APIs present in the provided workspace
   * 
   * @param {String} apiKey - API key to be used to authenticate the postman API
   * @param {Object} workspace - The workspace object for which the APIs needs to be fetched
   * @param {function} cb - the callback function, called with (error, results)
   */
  getApisInAWorkspace: function (apiKey, workspace, cb) {
    let options = {
      method: 'GET',
      url: `${POSTMAN_API_URL}/apis?workspace=${workspace.id}`,
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      }
    };

    request(options, function (err, response) {
      if (err) {
        return cb(err);
      }

      let apis = JSON.parse(response.body).apis;
      if (!apis) {
        return cb(null, []);
      }

      apis = apis.map((api) => {
        api.label = api.name;
        return api;
      });

      return cb(null, apis);
    });
  },

  /**
   * Fetches all the versions of the API provided
   * 
   * @param {String} apiKey - API key to be used to authenticate the postman API
   * @param {Object} api - The API object for which the different versions needs to be fetched
   * @param {function} cb  - the callback function, called with (error, results)
   */
  getApiVersions: function(apiKey, api, cb) {
    let options = {
      method: 'GET',
      url: `${POSTMAN_API_URL}/apis/${api.id}/versions`,
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      }
    };

    request(options, function (err, response) {
      if (err) {
        return cb(err);
      }

      let apiVersions = JSON.parse(response.body).versions;
      if (!apiVersions) {
        return cb(null, []);
      }

      apiVersions = apiVersions.map((apiVersion) => {
        apiVersion.label = apiVersion.name;
        return apiVersion;
      });

      return cb(null, apiVersions);
    });
  },

  /**
   * Displays an input box to the user, with the placeholder text provided
   * 
   * @param {String} placeHolder - The placeholder to be displayed in the input box
   */
  showInputBox: function (placeHolder) {
    return vscode.window.showInputBox({
      placeHolder,
      ignoreFocusOut: true
    });
  },

  /**
   * Displays a dropdown list to the user, with the placeholder text provided
   * 
   * @param {Arrat} items - An array of items to be displayed in the dropdown, from which the user can select an option
   * @param {String} placeHolder  - The placeholder to be displayed in the dropdown box
   */
  showDropdown: function (items, placeHolder) {
    return vscode.window.showQuickPick(items, {
      placeHolder,
      ignoreFocusOut: true,
      canPickMany: false
    });
  },

  /**
   * Shows an error toast
   * 
   * @param {String} err - The error to be displayed
   */
  showError: function(err) {
    vscode.window.showErrorMessage(err);
  },

  /**
   * Shows an information toast
   * 
   * @param {String} info - The information to be displayed
   */
  showInfo: function(info) {
    vscode.window.showInformationMessage(info);
  }
};