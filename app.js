// DDX Bricks Wiki - See https://developer.domo.com/docs/ddx-bricks/getting-started-using-ddx-bricks
// for tips on getting started, linking to Domo data and debugging your app
 


//
// Define which fields you want to be able to filter by here
//
var fields = ["PROD_NAME"]
let data; // Global variable to store the data

var domo = window.domo; // For more on domo.js: https://developer.domo.com/docs/dev-studio-guides/domo-js#domo.get
var datasets = window.datasets;

fetchData();

async function fetchData() {
    try {
        // clear existing filters
        domo.filterContainer([]);
        data = await getData();
        // Now you have access to the resolved data directly
        console.log(data);
    } catch (error) {
        console.error("Error fetching data:", error);
    }
}

async function getData(){
  // Get Data From Dataset
  var query = `/data/v1/${datasets[0]}?fields=${fields.join()}`;
  const data = await domo.get(query);
  return data;
}

var inputElement = document.getElementById('inputText');
var submitButton = document.getElementById('submitButton');
var clearButton = document.getElementById('clearButton');


 // Setup event listener on filter form
  submitButton.addEventListener('click', async function(event) {
      

      event.preventDefault();
      const inputValue = inputElement.value;
      console.log('Captured value:', inputValue);

      // Disable the submit button and show "Generating Filters" text
      submitButton.disabled = true;
      submitButton.innerText = 'Generating Filters';

      console.log('converting question to a prompt');

      console.log("data", data)

      var possibleValuesforColumns = getPossibleValuesForColumns(data, fields);

      console.log("GETTING POSSIBLE VALUES....")
      console.log("RESULT",possibleValuesforColumns)

      const prompt = constructPrompt(inputValue, fields, possibleValuesforColumns);

      console.log('prompting GPT to create filtersArray');
      try {
          const filtersArray = await getFiltersArray(prompt);
          console.log('applying filter');
          domo.filterContainer(filtersArray);
      } catch (error) {
          console.error('Error:', error);
      } finally {
          // Re-enable the submit button and restore its original text
          submitButton.disabled = false;
          submitButton.innerText = 'Submit';
      }
  });

domo.onFiltersUpdate(console.log);



clearButton.addEventListener('click', function() {
  
  console.log("clearing filters");
  domo.filterContainer([]);

});


function handleInputChange() {
    if (inputElement.value.length >=3) {
        submitButton.removeAttribute('disabled');
    } else {
        submitButton.setAttribute('disabled', 'true');
    }
}

function constructPrompt(question, columns, possibleValuesforColumns) {

	const prompt = `Please provide a response containing only valid JSON suitable for the domo.filterContainer method. This method accepts an array of objects that constitute a filter configuration. Your response should strictly adhere to the JSON format.

Example of applying the method:
domo.filterContainer([{
    column: 'category',
    operator: 'IN',
    values: ['ALERT'],
    dataType: 'STRING'
}]);

Here are the specifications for each attribute:
- column: A string representing the column name.
- operator: The comparison operator for the filter. Available options are: 'IN', 'NOT_IN', 'GREATER_THAN', 'GREAT_THAN_EQUALS_TO', 'LESS_THAN', 'LESS_THAN_EQUALS_TO', 'BETWEEN', 'NOT_BETWEEN', 'LIKE', 'NOT_LIKE'.
- values: An array of values for comparison.
- dataType: The data type of values in the array. Possible values are: 'DATE', 'DATETIME', 'NUMERIC', 'STRING'.

The filter container should be configured based on the question: "${question}".

The available column names for the filter container are: ${columns}.

The values in the filter container must be chosen from this list of possible values: ${possibleValuesforColumns}. 
No values outside this list should be generated.
When configuring the filter container, please select values containing the specified text or related to the request as closely as possible. 
Only use the list of possible values provided here: ${possibleValuesforColumns}.
Please remember that this must be valid json only that matches the filterContainer.`;
  
  return prompt;

}

function getPossibleValuesForColumns(data, columns) {
    const valueCounts = {};

    // Initialize valueCounts object with empty Sets for each column
    columns.forEach(column => {
        valueCounts[column] = new Set();
    });

    // Iterate through data to collect unique non-empty values for each column
    data.forEach(entry => {
        columns.forEach(column => {
            const value = entry[column];
            if (value !== undefined && value !== null && value !== "") {
                valueCounts[column].add(value);
            }
        });
    });

    // Convert Sets to arrays and construct the string representation
    let result = '';
    columns.forEach(column => {
        const possibleValues = Array.from(valueCounts[column]);
        result += `Possible values for '${column}' include: ${possibleValues.join(', ')}. \n`;
    });

    return result;
}


function generateText(prompt) {
  const body = {
    "input": prompt
  }

  return domo.post(`/domo/ai/v1/text/generation`, body)
}

async function getFiltersArray(prompt) {
  
  console.log(prompt);
  console.log("generating text");
  const gptResponse = await generateText(prompt);
  
  // Parse the JSON response and validate it
  try {
    const jsonResponse = gptResponse.choices[0].output;
    const parsedResponse = JSON.parse(jsonResponse);
    if (validateFilterConfig(parsedResponse)) {
      console.log("JSON response is valid and parsed successfully:", parsedResponse);
      return parsedResponse
    } else {
      console.log("JSON response is not valid.");
    }
  } catch (error) {
    console.error("Error parsing JSON response:", error.message);
  }
}

// Function to validate the JSON response
function validateFilterConfig(config) {
  if (!Array.isArray(config)) {
    return false;
  }

  for (const filter of config) {
    if (
      typeof filter.column !== "string" ||
      typeof filter.operator !== "string" ||
      !Array.isArray(filter.values) ||
      filter.values.length === 0 ||
      typeof filter.dataType !== "string" ||
      !["DATE", "DATETIME", "NUMERIC", "STRING"].includes(filter.dataType)
    ) {
      return false;
    }
  }

  return true;
}


