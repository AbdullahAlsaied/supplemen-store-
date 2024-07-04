const express = require('express');
const mysql = require('mysql2');
const ejs = require('ejs');
const cors = require("cors");
const bodyParser = require('body-parser');
const session = require('express-session');

const app = express();
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: "secret", resave: false, saveUninitialized: true }));

const port = 5500;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "codeAlpha"
});

db.connect(err => {
    if (err) {
        console.error('Database connection failed: ' + err.stack);
        return;
    }
    console.log('Connected to database.');
});

app.get('/', (req, res) => {
    db.query("SELECT * FROM products", (err, result) => {
        if (err) {
            console.error(err);
            res.status(500).send("Error retrieving products");
        } else {
            res.render('pages/index', { result: result });
        }
    });
});

function isProductInCart(cart, id) {
    return cart.some(item => item.id === id);
}

function calculateTotal(cart, req) {
    let total = 0;
    for (let i = 0; i < cart.length; i++) {
        if (cart[i].sale_price) {
            total += cart[i].sale_price * cart[i].quantity;
        } else {
            total += cart[i].price * cart[i].quantity;
        }
    }
    req.session.total = total;
    return total;
}

app.post('/add_to_cart', (req, res) => {
    const { id, name, price, sale_price, quantity = 1, image } = req.body;
    const product = { id, name, price: parseFloat(price), sale_price: parseFloat(sale_price), quantity: parseInt(quantity), image };

    if (req.session.cart) {
        const cart = req.session.cart;
        if (!isProductInCart(cart, id)) {
            cart.push(product);
        } else {
            for (let i = 0; i < cart.length; i++) {
                if (cart[i].id === id) {
                    cart[i].quantity += product.quantity;
                    break;
                }
            }
        }
    } else {
        req.session.cart = [product];
    }

    calculateTotal(req.session.cart, req);
    res.redirect('/cart');
});


app.get('/cart', (req, res) => {
    const cart = req.session.cart || [];
    const total = req.session.total || 0;

    res.render('pages/cart', { cart: cart, total: total });
});

app.post('/remove_product', (req, res) => {
    const id = req.body.id;
    const cart = req.session.cart;

    for (let i = 0; i < cart.length; i++) {
        if (cart[i].id === id) {
            cart.splice(i, 1);
            break;
        }
    }

    calculateTotal(cart, req);
    res.redirect('/cart');
});

app.post('/update_quantity', (req, res) => {
    const { id, quantity } = req.body;
    const cart = req.session.cart;

    for (let i = 0; i < cart.length; i++) {
        if (cart[i].id === id) {
            cart[i].quantity = parseInt(quantity);
            break;
        }
    }

    calculateTotal(cart, req);
    res.redirect('/cart');
});

app.get('/checkout', (req, res) => {
    const cart = req.session.cart || [];
    const total = req.session.total || 0;
    res.render('pages/checkout', { cart: cart, total: total });
});

app.post('/place_order', (req, res) => {
    const { name, email, phone, city, address, note } = req.body;
    const cost = req.session.total;
    const status = "not paid";
    const date = new Date();
    let product_ids = "";

    const con = mysql.createConnection({
        host: "localhost",
        user: "root",
        password: "",
        database: "codeAlpha"
    });

    const cart = req.session.cart;
    if (cart && Array.isArray(cart) && cart.length > 0) {
        for (let i = 0; i < cart.length; i++) {
            product_ids = product_ids + (i === 0 ? "" : ",") + cart[i].id;
        }
    } else {
        res.status(400).send("Cart is empty or undefined");
        return;
    }

    con.connect(err => {
        if (err) {
            console.log(err);
            res.status(500).send("Error connecting to database");
        } else {
            const query = "INSERT INTO orders (cost, name, email, status, city, address, phone, date, product_ids, note) VALUES ?";
            const values = [
                [cost, name, email, status, city, address, phone, date, product_ids, note]
            ];
            con.query(query, [values], (err, result) => {
                if (err) {
                    console.log(err);
                    res.status(500).send("Error placing order");
                } else {
                    const orderId = result.insertId; // Get the ID of the inserted order
                    req.session.cart = [];
                    req.session.total = 0;
                    res.render('pages/orderDone', {
                        id: orderId,
                        name: name,
                        email: email,
                        phone: phone,
                        city: city,
                        address: address,
                        note: note,
                        cost: cost,
                        date: date,
                        product_ids: product_ids
                    });
                }
            });
        }
    });
});


app.get('/order-done', (req, res) => {
    const { id, name, email, phone, city, address, note, cost, date, product_ids } = req.query;
    const orderData = {
      id: id,
      name: name,
      email: email,
      phone: phone,
      city: city,
      address: address,
      note: note,
      cost: cost,
      date: date,
      product_ids: product_ids
    };
    res.render('pages/orderDone', orderData);
});



app.get('/', (req, res) => {
    res.render('pages/index');
});

app.get('/about', (req, res) => {
    res.render('pages/about');
});

app.get('/contact', (req, res) => {
    res.render('pages/contact');
});

app.get('/special', (req, res) => {
    res.render('pages/special');
});

app.get('/brand', (req, res) => {
    res.render('pages/brand');
});
