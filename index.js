const express = require('express');
const hbs = require('hbs');
const wax = require('wax-on');
require('dotenv').config();
const { createConnection } = require('mysql2/promise');

let app = express();
app.set('view engine', 'hbs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));

wax.on(hbs.handlebars);
wax.setLayoutPath('./views/layouts');

// Register the eq helper
// require in handlebars and their helpers
const helpers = require('handlebars-helpers');
// tell handlebars-helpers where to find handlebars
helpers({
    'handlebars': hbs.handlebars
})

require('dotenv').config();


async function main() {
    try {
        connection = await createConnection({
            'host': process.env.DB_HOST,
            'user': process.env.DB_USER,
            'database': process.env.DB_NAME,
            'password': process.env.DB_PASSWORD
        });
        console.log("Connected to the database!");
    } catch (error) {
        console.error("Database connection failed:", error);
    }

    // Root route
    app.get('/', (req, res) => {
        res.send('Hello, World!');
    });

    // Route to display customers
    app.get('/customers', async (req, res) => {
        const [customers] = await connection.execute(`
            SELECT Customers.*, Companies.name as company_name
            FROM Customers
            LEFT JOIN Companies ON Customers.company_id = Companies.company_id
        `);
    
        res.render('customers/index', { customers });
    });

    // Route to display the form to create a new customer
    app.get('/customers/create', async (req, res) => {
        try {
            let [companies] = await connection.execute('SELECT * FROM Companies');
            let [employees] = await connection.execute('SELECT * FROM Employees');
            res.render('customers/add', {
                'companies': companies,
                'employees': employees
            });
        } catch (error) {
            console.error('Error fetching companies or employees:', error);
            res.status(500).send("Error retrieving companies or employees.");
        }
    });

    // Route to process the form and add a new customer
app.post('/customers/create', async (req, res) => {
    try {
        let { first_name, last_name, rating, company_id, employee_id } = req.body;

        // Insert the new customer into the Customers table
        let query = 'INSERT INTO Customers (first_name, last_name, rating, company_id) VALUES (?, ?, ?, ?)';
        let bindings = [first_name, last_name, rating, company_id];
        let [result] = await connection.execute(query, bindings);

        // Get the newly created customer ID
        let newCustomerId = result.insertId;

        // Insert the relationships into the EmployeeCustomer table
        if (Array.isArray(employee_id)) {  // Check if employee_id is an array
            for (let id of employee_id) {
                let query = 'INSERT INTO EmployeeCustomer (employee_id, customer_id) VALUES (?, ?)';
                let bindings = [id, newCustomerId];
                await connection.execute(query, bindings);
            }
        }

        // Redirect to the customers page after adding
        res.redirect('/customers');
    } catch (error) {
        console.error('Error adding customer:', error);
        res.status(500).send("Error adding customer.");
    }
});


    app.get('/customers/:customer_id/edit', async (req, res) => {
        try {
            // Fetch all employees
            let [employees] = await connection.execute('SELECT * FROM Employees');
            
            // Fetch the customer based on the provided customer_id
            let [customers] = await connection.execute('SELECT * FROM Customers WHERE customer_id = ?', [req.params.customer_id]);
            
            // Fetch employees associated with the customer
            let [employeeCustomers] = await connection.execute('SELECT * FROM EmployeeCustomer WHERE customer_id = ?', [req.params.customer_id]);
            
            // Fetch all companies
            let [companies] = await connection.execute('SELECT * FROM Companies'); 
    
            // Check if the customer was found
            if (customers.length === 0) {
                return res.status(404).send("Customer not found");
            }
    
            // Get the customer details
            let customer = customers[0];
    
            // Get the related employee IDs
            let relatedEmployees = employeeCustomers.map(ec => ec.employee_id);
    
            // Render the edit page with the fetched data
            res.render('customers/edit', {
                'customer': customer,
                'employees': employees,
                'relatedEmployees': relatedEmployees,
                'companies': companies
            });
        } catch (error) {
            console.error('Error fetching customer for edit:', error);
            res.status(500).send("Error retrieving customer details.");
        }
    });
    

    // Route to process the form to update a specific customer
    app.post('/customers/:customer_id/edit', async (req, res) => {
        let {first_name, last_name, rating, company_id} = req.body;
        let query = 'UPDATE Customers SET first_name=?, last_name=?, rating=?, company_id=? WHERE customer_id=?';
        let bindings = [first_name, last_name, rating, company_id, req.params.customer_id];
        await connection.execute(query, bindings);
        res.redirect('/customers');
    })
    

    
    app.get('/customers/:customer_id/delete', async function(req,res){
        // display a confirmation form 
        const [customers] = await connection.execute(
            "SELECT * FROM Customers WHERE customer_id =?", [req.params.customer_id]
        );
        const customer = customers[0];

        res.render('customers/delete', {
            customer
        })

    })


    //delete
    app.post('/customers/:customer_id/delete', async function(req, res){
        await connection.execute(`DELETE FROM Customers WHERE customer_id = ?`, [req.params.customer_id]);
        res.redirect('/customers');
    })


    // Start the server
    app.listen(3000, () => {
        console.log('Server is running on http://localhost:3000');
    });
}

main();
