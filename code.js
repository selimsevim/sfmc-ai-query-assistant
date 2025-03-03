%%[  
VAR @queryInput, @jsonResponse  
SET @queryInput = RequestParameter("query")  

IF RequestParameter("submitted") == "submitted" THEN  
]%%  

<script runat="server">
    Platform.Load("Core", "1");

    function escapeJSONString(str) {
        return str.replace(/\\/g, '\\\\')    
                  .replace(/"/g, '\\"')     
                  .replace(/\n/g, '\\n')    
                  .replace(/\r/g, '\\r')    
                  .replace(/\t/g, '\\t');   
    }

    try {
        var userMessage = Variable.GetValue("@queryInput");

        var contentType = 'application/json';
        var headerNames = ["Authorization"];
        var headerValues = ["Bearer API_KEY_OPEN_AI"]; 


        // 🔹 **Dynamic Lookup for Data Extension References**
        var referenceTable = "de_references"; // DE mapping
        var retrievedDEs = Platform.Function.LookupRows(referenceTable, "default", "1");
        var deMappings = "";

        if (retrievedDEs.length > 0) {
            for (var i = 0; i < retrievedDEs.length; i++) {
                var refName = retrievedDEs[i]["Reference"];
                var deName = retrievedDEs[i]["Data Extension Name"];
                deMappings += refName + " - " + deName + "\n";
            }
        }

        // 🔹 **Dynamic Lookup for Field References**
        var fieldTable = "field_references"; // Field mapping DE
        var retrievedFields = Platform.Function.LookupRows(fieldTable, "default", "1");
        var fieldMappings = "";

        if (retrievedFields.length > 0) {
            for (var i = 0; i < retrievedFields.length; i++) {
                var refName = retrievedFields[i]["Reference"];
                var deName = retrievedFields[i]["Data Extension Name"];
                var fieldName = retrievedFields[i]["Field Name"];
                fieldMappings += refName + " - " + deName + " - " + fieldName + "\n";
            }
        }

        var systemPrompt = "You are an AI that extracts Data Extensions (DEs) and fields from user queries in Salesforce Marketing Cloud.\n\n" +

            "- **Extract DE names** if explicitly mentioned OR mapped via the Reference Table.\n" +
            "- **Extract Field names** if explicitly mentioned OR mapped via the Field Reference Table.\n" +
            "- **Prioritize user-stated DEs over reference mappings.**\n" +
            "- **If the user does NOT explicitly mention a field, use the Field Reference Table to infer it.**\n" +
            "- **If no DEs can be inferred, return: \"Please explain yourself one more time.\"**\n" +
            "- **If no fields can be inferred, leave the `fields` list empty.**\n\n" +
            "- **If a user query relates to email actions (open, click, send, bounce), extract BOTH `_job` as main DE and the related event DE (`_open`, `_click`, etc.).**\n" +
            "- **Ensure `_job` is always included as main DE when an email-related event is extracted.**\n\n" +

            "### **Reference Table (User-Friendly Terms → Data Extensions)**\n" +
            "```\n" +
            deMappings + 
            "```\n\n" +

            "### **Field Reference Table (User-Friendly Terms → DE & Fields)**\n" +
            "```\n" +
            fieldMappings + 
            "```\n\n" +

            "### **Output JSON Format (Pure JSON, No Formatting)**\n" +
            "{\n" +
            "  \"de_names\": [\"DE1\", \"DE2\", ...],\n" +
            "  \"fields\": [\"Field1\", \"Field2\", ...]\n" +
            "}\n";

            "### **Example Queries & Expected Output (Pure JSON Response)**\n\n" +

            "#### ✅ **Example 1: DE and Field Both Mapped via Reference**\n" +
            "**User Input:** \"How many contacts clicked X email last week?\"\n" +
            "**Reference Lookup:**\n" +
            "- **DE Reference:** 'Email' → `_job`, 'Click' → `_click`\n" +
            "- **Field Reference:** 'Click Date, Clicked' → `EventDate`\n" +
            "**Output:**\n" +
            "{ \"de_names\": [\"_job\"], [\"_click\"], \"fields\": [\"EventDate\"] }\n\n" +

            "#### ✅ **Example 2: DE Explicitly Mentioned and Referenced, Field Mapped via Reference**\n" +
            "**User Input:** \"How many contacts from Customer DE have purchased at least one product last week?\"\n" +
            "**Reference Lookup:**\n" +
            "- **DE Explicit:** 'Customer_DE'\n" +
            "- **DE Reference:** 'Purchase' → `Purchase_DE`\n" +
            "- **Field Reference:** 'Purchase Date' → `TransactionDate`\n" +
            "**Output:**\n" +
            "{ \"de_names\": [\"Customer_DE\", \"Purchase_DE\"], \"fields\": [\"TransactionDate\"] }\n\n" +

            "#### ✅ **Example 3: DE Explicitly Mentioned, Field Explicitly Mentioned**\n" +
            "**User Input:** \"How many contacts opened X email last week? For contacts, check Contacts DE and for opens, check Opens DE and OpenDate from Opens DE for timeframe.\"\n" +
            "**Reference Lookup:**\n" +
            "- **DE Explicit:** `Contacts_DE`, `Opens_DE`\n" +
            "- **Field Explicit:** `OpenDate`\n" +
            "**Output:**\n" +
            "{ \"de_names\": [\"Contacts_DE\", \"Opens_DE\"], \"fields\": [\"OpenDate\"] }\n\n" +

            "#### ❌ **Example 4: No DE Identified, Query is Unclear**\n" +
            "**User Input:** \"Show me recent actions.\"\n" +
            "**Reference Lookup:**\n" +
            "- **DE Reference:** No match found\n" +
            "- **Field Reference:** No match found\n" +
            "**Output:**\n" +
            "{ \"de_names\": [], \"fields\": [], \"message\": \"Please explain yourself one more time.\" }\n";


        var escapedSystemPrompt = escapeJSONString(systemPrompt);
        var escapedUserMessage = escapeJSONString(userMessage);

        var jsonBody = '{"model": "gpt-4o",' +
            '"messages": [' +
            '{"role": "system", "content": "' + escapedSystemPrompt + '"},' +
            '{"role": "user", "content": "' + escapedUserMessage + '"}' +
            '],' +
            '"temperature": 0.7,' +
            '"max_tokens": 100}';

        var requestUrl = "https://api.openai.com/v1/chat/completions";
        var request = HTTP.Post(requestUrl, contentType, jsonBody, headerNames, headerValues);
        var response = request.Response.toString();

        var json = Platform.Function.ParseJSON(response);
        var content = json.choices[0].message.content;

        content = content.replace(/^```json\s*/, "").replace(/```$/, "");

        var parsedData = Platform.Function.ParseJSON(content);

        var deNames = parsedData.de_names;  
        var fields = parsedData.fields;  

        var focusedFields = parsedData.fields;

        var structuredOutput = [];
        var deRelationships = "";
        var prox = new Script.Util.WSProxy();

        // ✅ List of Known SFMC Data Views
        var dataViewNames = ["_job", "_open", "_subscribers"];
        var dataViewNamesStr = dataViewNames.toString();

        // ✅ Predefined field mapping for Data Views
        var dataViewFields = {
            "_job": [
                { "field_name": "JobID", "field_type": "Number" },
                { "field_name": "EmailName", "field_type": "Text" },
                { "field_name": "DeliveredTime", "field_type": "Date" }
            ],
            "_open": [
                { "field_name": "SubscriberKey", "field_type": "Text" },
                { "field_name": "EventDate", "field_type": "Date" },
                { "field_name": "IsUnique", "field_type": "Boolean" },
                { "field_name": "JobID", "field_type": "Number" }
            ],
            "_subscribers": [
                { "field_name": "EmailAddress", "field_type": "Text" },
                { "field_name": "SubscriberKey", "field_type": "Text" }
            ]
        };

        // ✅ Retrieve Fields for Each Data Extension
        for (var i = 0; i < deNames.length; i++) {
            var deName = deNames[i];

            // ✅ Convert deName to a string and check existence in dataViewNamesStr
            if ((dataViewNamesStr.toString()).indexOf(deName) !== -1) {
                structuredOutput.push({
                    "de_name": deName,
                    "de_fields": dataViewFields[deName],
                    "focused_fields": focusedFields
                });
                continue; // Skip field retrieval for Data Views
            }

            // ✅ Otherwise, retrieve fields dynamically for normal DEs
            var deFilter = { Property: "Name", SimpleOperator: "equals", Value: deName };
            var deCols = ["Name", "CustomerKey"];
            var deResult = prox.retrieve("DataExtension", deCols, deFilter);

            if (deResult.Results.length > 0) {
                var deKey = deResult.Results[0].CustomerKey;

                var fieldCols = ["Name", "FieldType"];
                var fieldFilter = { Property: "DataExtension.CustomerKey", SimpleOperator: "equals", Value: deKey };
                var fieldResult = prox.retrieve("DataExtensionField", fieldCols, fieldFilter);

                var fieldDetails = [];
                for (var j = 0; j < fieldResult.Results.length; j++) {
                    fieldDetails.push({
                        "field_name": fieldResult.Results[j].Name,
                        "field_type": fieldResult.Results[j].FieldType
                    });
                }

                structuredOutput.push({
                    "de_name": deName,
                    "de_fields": fieldDetails,
                    "focused_fields": focusedFields
                });
            }
        }

        // ✅ Retrieve Relationships for Data Extensions
        var relationshipTable = "relationships";
        var relFilter = { Property: "default", SimpleOperator: "equals", Value: "1" };
        var relCols = ["DE1", "DE2", "RelationshipField"];
        var relResult = prox.retrieve("DataExtension", relCols, relFilter);

        if (relResult.Results.length > 0) {
            for (var k = 0; k < relResult.Results.length; k++) {
                deRelationships += relResult.Results[k]["DE1"] + " - " +
                                   relResult.Results[k]["DE2"] + " - " +
                                   relResult.Results[k]["RelationshipField"] + "\n";
            }
        }

        var systemPrompt = "You are an AI that generates SQL queries for Salesforce Marketing Cloud (SFMC). Only generate the query, do not explain anything. Follow these strict rules:\n\n" +

            "### **🔹 SQL Rules (Strict Adherence Required)**\n" +
            "- **Allowed Clauses:** SELECT, JOIN, WHERE, GROUP BY, HAVING, ROW_NUMBER.\n" +
            "- **Prohibited Clauses:** INSERT, UPDATE, DELETE, ORDER BY (unless inside `ROW_NUMBER() OVER (...)`), WITH.\n" +
            "- **Allowed Joins:** INNER JOIN, LEFT JOIN (NO CROSS JOIN).\n" +
            "- **Field Selection:** Do NOT use `*`. Always list fields explicitly.\n" +
            "- **Data Extension Naming:** Use square brackets `[ ]` for DEs ALWAYS.\n" +
            "- **Table Aliases:** Use aliases for readability, but keep full DE names in `FROM` and `JOIN`.\n" +
            "- **Query Efficiency:** Always optimize queries for readability and performance.\n\n" +

            "### **🔹 Data Views Handling Rules**\n" +
            "- **SFMC Data Views such as `_job`, `_open`, `_click`, `_bounce`, etc., must be handled with proper joins.**\n" +
            "- **If a user query involves opens, clicks, or sends, extract BOTH `_job` (Emails DE) AND the relevant event DE (`_open`, `_click`, etc.).**\n" +
            "- **Always JOIN `_job` with event-based Data Views using `JobID` or `SubscriberKey`, based on available relationships.**\n" +
            "- **Ensure that filters involving email sends, opens, clicks, or bounces use the correct event timestamps (e.g., `EventDate`).**\n" +
            "- **For user-based segmentation, ensure correct filtering based on SubscriberKey from `_Subscribers`.**\n\n" +

            "### **🔹 De-Duplication Rules (Strict Guidelines)**\n" +
            "- **To remove duplicates, ALWAYS use `ROW_NUMBER() OVER (PARTITION BY ...) ORDER BY ...` inside a subquery.**\n" +
            "- **Never use `ROW_NUMBER()` directly in the `WHERE` clause. Always reference `row_num` from the subquery.**\n" +
            "- **Ensure that the `PARTITION BY` field uniquely identifies duplicate groups (e.g., RecordID for transactions).**\n" +
            "- **The sorting field in `ORDER BY` must ensure the most relevant record is kept (e.g., latest transaction).**\n\n" +

            "### **🔹 Data Extensions & Fields (STRICT CONSTRAINT - DO NOT HALLUCINATE FIELDS)**\n" +
            "- **You can ONLY use fields from `de_fields`.**\n" +
           
            "```\n" +
            Stringify(structuredOutput) + 
            "```\n\n" +

            "### **🔹 DE Relationship Table (How DEs Connect via Fields)**\n" +
            "```\n" +
            deRelationships + 
            "```\n\n" +

            "### **🔹 SQL Query Generation - Step-by-Step Rules**\n" +

            "1️⃣ **Step 1: Validate Fields Before Query Generation**\n" +
            "- **Cross-check every requested field against `de_fields`.**\n" +
            "- **If a field is missing, STOP and return an error.**\n" +
            "- **NEVER assume missing fields exist. Do NOT generate queries with non-existent fields.**\n\n" +

            "2️⃣ **Step 2: Determine the Main Data Extension (FROM Clause)**\n" +
            "- **If multiple DEs exist, select the one most directly tied to the query intent.**\n" +
            "- **If unsure, default to the DE where the majority of relevant fields exist.**\n\n" +

            "3️⃣ **Step 3: Select Fields for the Query**\n" +
            "- **If the user explicitly states which fields to bring (`only X field(s)`, `bring X, Y, Z fields`), use those fields.**\n" +
            "- **If the user mentions fields in `WHERE` or `JOIN` but NOT in `SELECT`, do NOT assume they only want those fields.**\n" +
            "- **Fallback Rule:** If no specific fields are mentioned, bring ALL fields from the main (first) table in the query.\n\n" +

            "4️⃣ **Step 4: Determine JOINs Using Relationship Table**\n" +
            "- **Use `deRelationships` to connect DEs correctly.**\n" +
            "- **Ensure correct join conditions using the provided relationship fields.**\n\n" +

            "5️⃣ **Step 5: Apply Necessary Filters (WHERE, GROUP BY, etc.)**\n" +
            "- **If a time-based filter is needed (`last week`), use the correct field from the main DE.**\n\n" +

            "### **🔹 Output Format Rules**\n" +
            "- **Return ONLY the SQL query as plain text.**\n" +
            "- **Do NOT include `SQL Output:`, `Here is your SQL:`, or any extra text.**\n\n" +

            "### **🔹 Example Queries with Structured Input & Relationships**\n\n" +

            "**✅ Example 1: Query with No Fields Specified (Bring All Fields)**\n" +
            "**User Query:** Find all customers who purchased a product.\n" +
            "**Structured Input:**\n" +
            "```\n" +
            "[{\"de_name\":\"Customer_DE\",\"de_fields\":[{\"field_name\":\"CustomerID\",\"field_type\":\"Text\"}, {\"field_name\":\"Name\",\"field_type\":\"Text\"}, {\"field_name\":\"Email\",\"field_type\":\"Text\"}]}]\n" +
            "```\n" +
            "**Generated Query:**\n" +
            "SELECT c.CustomerID, c.Name, c.Email\n" +
            "FROM Customer_DE c\n\n" +

            "**✅ Example 2: Query with Time-Based Filter**\n" +
            "**User Query:** Find all purchases made in the last 7 days.\n" +
            "**Generated Query:**\n" +
            "SELECT p.PurchaseID, p.CustomerID, p.PurchaseDate\n" +
            "FROM Purchase_DE p\n" +
            "WHERE p.PurchaseDate >= DATEADD(DAY, -7, GETDATE())\n\n" +

            "**✅ Example 3: Query with Explicit Fields & Join Condition**\n" +
            "**User Query:** Find customers who purchased a product and their opt-in status.\n" +
            "**Generated Query:**\n" +
            "SELECT c.CustomerID, c.Name, c.Email, con.OptInStatus\n" +
            "FROM Customer_DE c\n" +
            "INNER JOIN Purchase_DE p ON c.CustomerID = p.CustomerID\n" +
            "LEFT JOIN Consent_DE con ON c.CustomerID = con.CustomerID\n\n" +

            "**✅ Example 4: Query with De-Duplication (Strict Subquery Usage)**\n" +
            "**User Query:** Show me the data from TestData_DE with de-duplication.\n" +
            "**Structured Input:**\n" +
            "```\n" +
            "[{\"de_name\":\"TestData_DE\",\"de_fields\":[{\"field_name\":\"TransactionDate\",\"field_type\":\"Date\"}, {\"field_name\":\"Name\",\"field_type\":\"Text\"}, {\"field_name\":\"Category\",\"field_type\":\"Text\"}, {\"field_name\":\"Amount\",\"field_type\":\"Number\"}, {\"field_name\":\"RecordID\",\"field_type\":\"Text\"}],\"focused_fields\":[]}]\n" +
            "```\n" +
            "**DE-Duplication Rule:**\n" +
            "- **Partition by `RecordID` (removing duplicate transactions).**\n" +
            "- **Order by `TransactionDate DESC` (keeping the latest record).**\n" +
            "- **Use `row_num = 1` in `WHERE` from a subquery.**\n\n" +
            "**Generated Query:**\n" +
            "SELECT t.TransactionDate, t.Name, t.Category, t.Amount, t.RecordID\n" +
            "FROM (\n" +
            "    SELECT TransactionDate, Name, Category, Amount, RecordID, \n" +
            "           ROW_NUMBER() OVER (PARTITION BY RecordID ORDER BY TransactionDate DESC) AS row_num\n" +
            "    FROM TestData_DE\n" +
            ") t\n" +
            "WHERE t.row_num = 1\n\n"


        // ✅ Send Data to GPT for SQL Generation
        var escapedSystemPrompt = escapeJSONString(systemPrompt);
        var escapedUserMessage = escapeJSONString(userMessage);

        var jsonBody = '{"model": "gpt-4o",' +
            '"messages": [' +
            '{"role": "system", "content": "' + escapedSystemPrompt + '"},' +
            '{"role": "user", "content": "' + escapedUserMessage + '"}' +
            '],' +
            '"temperature": 0.7,' +
            '"max_tokens": 300}';

        var requestUrl = "https://api.openai.com/v1/chat/completions";
        var request = HTTP.Post(requestUrl, contentType, jsonBody, headerNames, headerValues);
        var response = request.Response.toString();

        var json = Platform.Function.ParseJSON(response);
        var content = json.choices[0].message.content;

        content = content.replace(/^```sql\s*/, "").replace(/```$/, "");

        Variable.SetValue("@jsonResponse", content);

    } catch (error) {
        Variable.SetValue("@jsonResponse", "Error: " + Stringify(error));
    }
</script>



%%[  
ENDIF  
]%%  

<!DOCTYPE html>
<html lang="en">
<head>
    <title>AI Query Assistant</title>
    <style>
        body { font-family: 'Poppins', sans-serif; background-color: #f9f9f9; color: #333; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .container { width: 60%; text-align: center; }
        textarea { width: 100%; height: 200px; padding: 15px; border-radius: 8px; font-size: 18px; border: 1px solid #ccc; resize: none; outline: none; background: #fff; }
        button { margin-top: 10px; padding: 15px 30px; font-size: 18px; border: none; cursor: pointer; border-radius: 5px; background: #007bff; color: white; }
        button:hover { background: #0056b3; }
        .output { margin-top: 20px; padding: 15px; background: #fff; border-radius: 8px; font-size: 16px; word-break: break-word; text-align: left; }
    </style>
</head>
<body>

    <div class="container">
        <h2>AI Query Assistant</h2>
        <form action="%%=RequestParameter('PAGEURL')=%%" method="post">
            <textarea name="query" placeholder="Enter your request here...">%%=v(@queryInput)=%%</textarea>
            <br>
            <button type="submit" name="submitted" value="submitted">Submit</button>
        </form>

        %%[ IF NOT EMPTY(@jsonResponse) THEN ]%%
        <div class="output">
            <h3>Query:</h3>
            <pre>%%=v(@jsonResponse)=%%</pre>
        </div>
        %%[ ENDIF ]%%  
    </div>

</body>
</html>
