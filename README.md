# SFMC AI Query Assistant
## Overview

The SFMC AI Query Assistant is a GPT-4o-powered tool designed to help Salesforce Marketing Cloud (SFMC) users easily generate optimized SQL queries from natural language inputs. By leveraging AI-driven intent recognition, it translates user-friendly queries into structured SQL statements, mapping relevant Data Extensions (DEs) and fields dynamically.

This tool eliminates the need for manual SQL writing, making data retrieval in SFMC faster, more accurate, and accessible to non-technical users. Additionally, it ensures SFMC SQL compliance, intelligently handling Data Views, enforcing valid joins, and preventing errors.

The assistant is expandable and can be enhanced with Data Extension management capabilities, allowing users to create, move, or delete DEs using simple commands. Whether you're a marketer, developer, or analyst, this AI-powered assistant helps streamline SFMC operations and improve efficiency.

## Features

✅ Natural Language to SQL – Enter a query like "Show me all contacts who clicked X email last week" and get the correct SQL.

✅ Dynamic Data Extension & Field Lookup – Uses reference tables to map friendly terms to DE names and fields.

✅ Strict SQL Compliance – Enforces SFMC SQL constraints (e.g., no WITH statements, correct JOINs, no unnecessary fields).

✅ Data Views Handling – Automatically includes _job, _open, _click, and other SFMC Data Views when needed.

✅ Error Handling & Query Validation – Ensures fields exist before generating queries to prevent errors.

✅ Scalable for Future AI Integrations – Can be expanded to include Data Extension management, automation, and reporting.



## How It Works

1️⃣ User enters a query in natural language.

2️⃣ GPT-4o extracts Data Extensions & fields from user input.

3️⃣ The assistant fetches all available fields for those DEs.

4️⃣ GPT-4o generates a fully structured SQL query based on the extracted data & relationships.

5️⃣ The user receives the final SQL output in a CloudPage interface.


## Example Queries & Outputs
🔹 User Input: "Find all contacts who clicked X email last week."

🔹 Structured prompts:


```
You are an AI that generates SQL queries for Salesforce Marketing Cloud (SFMC). Only generate the query, do not explain anything. Follow these strict rules:

### **🔹 SQL Rules (Strict Adherence Required)**
- **Allowed Clauses:** SELECT, JOIN, WHERE, GROUP BY, HAVING, ROW_NUMBER.
- **Prohibited Clauses:** INSERT, UPDATE, DELETE, ORDER BY (unless inside `ROW_NUMBER() OVER (...)`), WITH.
- **Allowed Joins:** INNER JOIN, LEFT JOIN (NO CROSS JOIN).
- **Field Selection:** Do NOT use `*`. Always list fields explicitly.
- **Data Extension Naming:** Use square brackets `[ ]` for DEs ALWAYS.
- **Table Aliases:** Use aliases for readability, but keep full DE names in `FROM` and `JOIN`.
- **Query Efficiency:** Always optimize queries for readability and performance.

### **🔹 Data Views Handling Rules**
- **SFMC Data Views such as `_job`, `_open`, `_click`, `_bounce`, etc., must be handled with proper joins.**
- **If a user query involves opens, clicks, or sends, extract BOTH `_job` (Emails DE) AND the relevant event DE (`_open`, `_click`, etc.).**
- **Always JOIN `_job` with event-based Data Views using `JobID` or `SubscriberKey`, based on available relationships.**
- **Ensure that filters involving email sends, opens, clicks, or bounces use the correct event timestamps (e.g., `EventDate`).**
.....

🔹 AI Output:

```
SELECT c.SubscriberKey, c.EventDate
FROM _click c
INNER JOIN _job j ON c.JobID = j.JobID
WHERE c.EventDate >= DATEADD(DAY, -7, GETDATE());
```

## Setup & Usage
📌 Requirements: SFMC CloudPage, Configuration Data Extensions (References and Relationships), SSJS, GPT API Key.

📌 Installation: Clone the repo, configure API keys, and deploy to your CloudPage.

📌 Customization: Modify prompts & SQL rules to fit your business needs.

📌 Necessary tables:

1️⃣ de_references (Data Extension Reference Table)

Stores mappings of user-friendly terms to actual Data Extension (DE) names.

de_references:
| Column                                   | Type    | Length | Nullable | Primary Key |
|------------------------------------------|---------|--------|----------|-------------|
| `Reference`                   | Text  | 155     | ❌       | ✔          |
| `DataExtensionName`                         | Text  | 155    | ❌       | ❌           |


2️⃣ field_references (Field Reference Table)

Maps user-friendly field names to actual fields within Data Extensions.

field_references:
| Column                                   | Type    | Length | Nullable | Primary Key |
|------------------------------------------|---------|--------|----------|-------------|
| `Reference`                   | Text  | 155     | ❌       | ✔          |
| `DataExtensionName`                         | Text  | 155    | ❌       | ❌           |
| `FieldName`                  | Text  | 155    | ❌       | ❌           |


3️⃣ relationships (Data Extension Relationships Table)

Defines how Data Extensions are related (used for JOIN conditions in SQL queries).

relationships:
| Column                                   | Type    | Length | Nullable | Primary Key |
|------------------------------------------|---------|--------|----------|-------------|
| `DE1`                   | Text  | 155     | ❌       | ✔          |
| `DE2`                         | Text  | 155    | ❌       | ❌           |
| `RelationshipField`                  | Text  | 155    | ❌       | ❌           |


```
## Contribution

Contributions are welcome! Feel free to open an issue or submit a pull request if you find a bug or have an idea for improvement.

## License

This project is licensed under the MIT License.
