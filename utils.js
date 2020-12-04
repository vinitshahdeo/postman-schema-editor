const request = require('request'),
  vscode = require('vscode'),
  async = require('async'),
  _ = require('lodash'),
  fs = require('fs'),
  path = require('path'),
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
  getApiVersions: function (apiKey, api, cb) {
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
   * 
   * Fetches schema for given API and API Version Id
   * 
   * @param {Object} credentials - contains { apiKey, apiId, apiVersionId }
   * @param {Function} cb - callback function called with (err, res) where res is the schema definition
   */
  fetchAPISchema: function (credentials, cb) {
    async.waterfall([
      (next) => {
        let options = {
          method: 'GET',
          url: `${POSTMAN_API_URL}/apis/${credentials.apiId}/versions/${credentials.apiVersionId}`,
          headers: {
            'x-api-key': credentials.apiKey,
            'Content-Type': 'application/json'
          }
        };
        request(options, (err, res) => {
          if (err) return next(err);
          
          return next(null, _.get(JSON.parse(res.body), 'version.schema')[0]);
        });
      },
      (schemaId, next) => {
        let options = {
          method: 'GET',
          url: `${POSTMAN_API_URL}/apis/${credentials.apiId}/versions/${credentials.apiVersionId}/schemas/${schemaId}`,
          headers: {
            'x-api-key': credentials.apiKey,
            'Content-Type': 'application/json'
          }
        };

        request(options, (err, res) => {
          if (err) return next(err);
          return next(null, JSON.parse(res.body).schema);
        });
      }
    ], (err, result) => {
      if (err) return cb(err);
      return cb(null, result);
    });
  },

  /**
   * Updates the schema to postman
   * 
   * @param {Object} payload
   * @param {String} payload.apiKey - API key to be used to authenticate the postman API
   * @param {string} payload.apiId - API Id of the updated schema
   * @param {string} payload.apiVersionId - The apiVersion Id of the updated schema 
   * @param {string} paylod.schemaId - schema Id of the updated schema
   * @param {Object} payload.schema - the updated schema
   * @param {function} cb  - the callback function, called with (error, response)
   */
  updateAPISchema: function (payload, cb) {
    // The code you place here will be executed every time your command is executed
		let options = {
			method: 'PUT',
			url: `${POSTMAN_API_URL}/apis/${payload.apiId}/versions/${payload.apiVersionId}/schemas/${payload.schemaId}`,
			headers: {
				'x-api-key': payload.apiKey,
				'Content-Type': 'application/json'
      },
      // TODO need to detect the type and language we want to update as
      body: JSON.stringify({
				schema: {
					type: payload.schemaType,
					language: payload.schemaLanguage,
					schema: payload.schema
				}
			})
    };
    request(options, function (error, response) {
      if (error) return cb(error);

      return cb(null, response);
    });

  },

  /**
   * 
   * Creates folder with API name and recursively creates files for different API versions
   * 
   * @param {String} xApiKey - Postman API Key
   * @param {Object} api - API Object contains { name, id }
   * @param {Function} cb - Callback function, called with error when any error occurs 
   */
  populateAPIVersions: function (xApiKey, api, cb) {

    let folderPath = vscode.workspace.workspaceFolders[0].uri.toString().split(':')[1];

    async.waterfall([
      (next) => {
        if (!fs.existsSync(`${folderPath}/${api.name}`)) {
          fs.mkdir(`${folderPath}/${api.name}`, (err) => {
            if (err) 
              return next(err);
            return next(null);
          });
        }
        else {
          return next(null);
        }
      },
      (next) => {
        let options = {
          method: 'GET',
          url: `${POSTMAN_API_URL}/apis/${api.id}/versions`,
          headers: {
            'x-api-key': xApiKey,
            'Content-Type': 'application/json'
          }
        };

        request(options, (err, res) => {
          if (err) return next(err);
          
          return next(null, JSON.parse(res.body).versions);
        });
      },
      (versions, next) => {
        async.forEachOf(versions, (version, next) => {
          this.fetchAPISchema({
            apiId: api.id,
            apiVersionId: version.id,
            apiKey: xApiKey
          }, (err, schema) => {
            if (err) return next(err);

            let filePath = path.join(folderPath, api.name, `${version.name}.${schema.language}`);

            fs.writeFile(filePath, schema.schema, {}, (err) => {
              if (err)
                return next(err);
            });
          })
        
        }, (err) => {
          if (err)
            return next(err);
        });
      }
    ], (err, result) => {
      if (err) 
        return cb(err);

      return cb(null, result);
    });
  },

  /**
   * Displays an input box to the user, with the placeholder text provided
   * 
   * @param {String} placeHolder - The placeholder to be displayed in the input box
   */
  showInputBox: function (options) {
    return vscode.window.showInputBox(_.merge(options, {
      ignoreFocusOut: true
    }));
  },

  /**
   * Displays a dropdown list to the user, with the placeholder text provided
   * 
   * @param {Array} items - An array of items to be displayed in the dropdown, from which the user can select an option
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
  showError: function (err) {
    vscode.window.showErrorMessage(err);
  },

  /**
   * Shows an information toast
   * 
   * @param {String} info - The information to be displayed
   */
  showInfo: function (info) {
    vscode.window.showInformationMessage(info);
  },

  setStatusBarMessage: function(text) {
    return vscode.window.setStatusBarMessage(text);
  }
};