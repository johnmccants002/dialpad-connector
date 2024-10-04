function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu("Dialpad Connector")
    .addItem("Open Connector", "showIndex")
    .addToUi();
}

function doGet() {
  var fileId = "1l9Wv2EsQf3s0ax48qA115yYvidZlWbJb"; // Replace with your file's ID
  var file = DriveApp.getFileById(fileId);
  var blob = file.getBlob();
  var imageData = Utilities.base64Encode(blob.getBytes());

  // Generate HTML content
  return HtmlService.createTemplateFromFile("index")
    .evaluate()
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setTitle("GIF Viewer")
    .getContent()
    .replace("IMAGE_PLACEHOLDER", "data:image/gif;base64," + imageData);
}

function getPreviousMonthDays() {
  // Get today's date
  var today = new Date();

  // Get the number of days in the previous month
  var firstDayOfCurrentMonth = new Date(
    today.getFullYear(),
    today.getMonth(),
    1
  );
  var lastDayOfPreviousMonth = new Date(firstDayOfCurrentMonth - 1);
  var daysInPreviousMonth = lastDayOfPreviousMonth.getDate();

  // Calculate daysAgoStart
  var daysAgoEnd = daysInPreviousMonth + today.getDate();

  // Calculate daysAgoEnd
  var daysAgoStart = daysAgoEnd - daysInPreviousMonth + 1;

  Logger.log("Days Ago Start: " + daysAgoStart);
  Logger.log("Days Ago End: " + daysAgoEnd);

  return {
    daysAgoStart: daysAgoStart,
    daysAgoEnd: daysAgoEnd,
  };
}

// Usage
function createDialpadReport() {
  var dateRange = getPreviousMonthDays();

  // Use dateRange.daysAgoStart and dateRange.daysAgoEnd in your Dialpad API call
}

function showIndex() {
  var html = HtmlService.createHtmlOutputFromFile("index")
    .setWidth(400)
    .setHeight(300);
  SpreadsheetApp.getUi().showSidebar(html);
}

function getStoredApiKey() {
  var apiKey =
    PropertiesService.getScriptProperties().getProperty("DIALPAD_API_KEY");
  return apiKey;
}

function storeApiKey(apiKey) {
  PropertiesService.getScriptProperties().setProperty(
    "DIALPAD_API_KEY",
    apiKey
  );
}

function showDepartments() {
  var html = HtmlService.createHtmlOutputFromFile("departments")
    .setWidth(400)
    .setHeight(600);
  SpreadsheetApp.getUi().showSidebar(html);
}

function getDepartments() {
  var apiKey =
    PropertiesService.getScriptProperties().getProperty("DIALPAD_API_KEY");
  if (!apiKey) {
    throw new Error("API key not found. Please enter a valid API key.");
  }

  var url = "https://dialpad.com/api/v2/departments?apikey=" + apiKey;
  var options = {
    method: "get",
    headers: {
      Accept: "application/json",
    },
  };

  try {
    var response = UrlFetchApp.fetch(url, options);
    var data = JSON.parse(response.getContentText());
    var departments = data.items.map(function (item) {
      return {
        id: item.id,
        name: item.name,
      };
    });
    return departments;
  } catch (e) {
    throw new Error("Failed to fetch departments: " + e.message);
  }
}

function storeSelectedDepartment(departmentId, departmentName) {
  PropertiesService.getScriptProperties().setProperty(
    "SELECTED_DEPARTMENT_ID",
    departmentId
  );
  PropertiesService.getScriptProperties().setProperty(
    "SELECTED_DEPARTMENT_NAME",
    departmentName
  );
}

function showCallData() {
  var html = HtmlService.createHtmlOutputFromFile("callData")
    .setWidth(400)
    .setHeight(600);
  SpreadsheetApp.getUi().showSidebar(html);
}

function getStoredDepartmentName() {
  return PropertiesService.getScriptProperties().getProperty(
    "SELECTED_DEPARTMENT_NAME"
  );
}

// Fetch call data and populate the sheet
function fetchCallData() {
  var apiKey =
    PropertiesService.getScriptProperties().getProperty("DIALPAD_API_KEY");
  var departmentId = PropertiesService.getScriptProperties().getProperty(
    "SELECTED_DEPARTMENT_ID"
  );

  if (!apiKey || !departmentId) {
    throw new Error("Missing API key or department ID.");
  }

  var initiateUrl = "https://dialpad.com/api/v2/stats?apikey=" + apiKey;
  const daysData = getPreviousMonthDays();

  var requestData = {
    days_ago_start: daysData.daysAgoStart,
    days_ago_end: daysData.daysAgoEnd,
    export_type: "stats",
    stat_type: "calls",
    target_type: "department",
    target_id: departmentId,
    timezone: "UTC",
  };

  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(requestData),
  };

  try {
    var initiateResponse = UrlFetchApp.fetch(initiateUrl, options);
    var initiateData = JSON.parse(initiateResponse.getContentText());
    var requestId = initiateData.request_id;

    var fetchUrl =
      "https://dialpad.com/api/v2/stats/" + requestId + "?apikey=" + apiKey;
    var fetchResponse = UrlFetchApp.fetch(fetchUrl);
    var fetchData = JSON.parse(fetchResponse.getContentText());

    var downloadUrl = fetchData.download_url;
    var fileType = fetchData.file_type;

    if (fileType === "csv") {
      var csvContent = UrlFetchApp.fetch(downloadUrl).getContentText();
      var csvData = Utilities.parseCsv(csvContent);

      var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
      sheet.clear();
      sheet
        .getRange(1, 1, csvData.length, csvData[0].length)
        .setValues(csvData);
    }
  } catch (e) {
    throw new Error("Failed to fetch call data: " + e.message);
  }
}

// Set up a time-based trigger for the first of every month
function setupMonthlyTrigger() {
  deleteTriggers();

  ScriptApp.newTrigger("fetchCallData")
    .timeBased()
    .onMonthDay(1)
    .atHour(9)
    .create();
}

// Helper function to delete all existing triggers
function deleteTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function (trigger) {
    ScriptApp.deleteTrigger(trigger);
  });
}
