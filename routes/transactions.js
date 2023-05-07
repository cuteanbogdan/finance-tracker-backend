// routes/transactions.js

const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middlewares/auth");

const Transaction = require("../Transaction");
const User = require("../User");

const axios = require("axios");

async function getExchangeRate(baseCurrency, targetCurrency) {
    try {
        const response = await axios.get(
            `https://api.exchangerate-api.com/v4/latest/${baseCurrency}`,
            {
                headers: {
                    'apikey': process.env.EXCHANGE_RATE_API_KEY,
                },
            }
        );
        return response.data.rates[targetCurrency];
    } catch (error) {
        throw new Error("Failed to get exchange rate");
    }
}

router.post("/add-transaction", isAuthenticated, async (req, res) => {
    const { type, date, amount, category, notes } = req.body;

    try {
        const newTransaction = new Transaction({
            user: req.user._id,
            type,
            date,
            amount,
            category,
            notes,
        });

        const savedTransaction = await newTransaction.save();

        // Find the user and update their balance based on the transaction type
        const user = await User.findById(req.user._id);
        if (type === "income") {
            user.balance += amount;
        } else if (type === "expense") {
            user.balance -= amount;
        }

        user.transactions.push(savedTransaction);
        await user.save();

        res.status(201).json(savedTransaction);
    } catch (error) {
        res.status(500).json({ message: "Server error: Unable to add transaction" });
    }
});

router.get("/all-transactions", isAuthenticated, async (req, res) => {
    try {
        const transactions = await Transaction.find({ user: req.user._id });

        const income = transactions
            .filter((transaction) => transaction.type === "income")
            .reduce((total, transaction) => total + transaction.amount, 0);

        const expenses = transactions
            .filter((transaction) => transaction.type === "expense")
            .reduce((total, transaction) => total + transaction.amount, 0);

        const balance = req.user.balance;

        res.status(200).json({ transactions, summary: { income, expenses, balance } });
    } catch (error) {
        res.status(500).json({ message: "Server error: Unable to get transactions" });
    }
});

// Update transaction
router.delete('/delete-transaction/:id', isAuthenticated, async (req, res) => {
    try {
        const deletedTransaction = await Transaction.findOneAndDelete({ _id: req.params.id, user: req.user._id });

        if (!deletedTransaction) {
            return res.status(404).json({ message: 'Transaction not found' });
        }

        const user = await User.findById(req.user._id);

        if (deletedTransaction.type === 'income') {
            user.balance -= deletedTransaction.amount;
        } else {
            user.balance += deletedTransaction.amount;
        }

        await user.save();

        // Remove the transaction from the user's transactions array
        await User.updateOne({ _id: req.user._id }, { $pull: { transactions: req.params.id } });

        res.status(200).json(deletedTransaction);
    } catch (error) {
        res.status(500).json({ message: 'Server error: Unable to delete transaction' });
    }
});

router.put('/update-transaction/:id', isAuthenticated, async (req, res) => {
    try {
        const { type, date, amount, category, notes } = req.body;
        const oldTransaction = await Transaction.findOne({ _id: req.params.id, user: req.user._id });

        if (!oldTransaction) {
            return res.status(404).json({ message: 'Transaction not found' });
        }

        const updatedTransaction = await Transaction.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id },
            { type, date, amount, category, notes },
            { new: true }
        );

        const user = await User.findById(req.user._id);

        if (oldTransaction.type === 'income') {
            user.balance -= oldTransaction.amount;
        } else {
            user.balance += oldTransaction.amount;
        }

        if (updatedTransaction.type === 'income') {
            user.balance += updatedTransaction.amount;
        } else {
            user.balance -= updatedTransaction.amount;
        }

        await user.save();

        res.status(200).json(updatedTransaction);
    } catch (error) {
        res.status(500).json({ message: 'Server error: Unable to update transaction' });
    }
});


router.put("/update-balance", isAuthenticated, async (req, res) => {
    try {
        const { balance } = req.body;

        await User.findByIdAndUpdate(req.user.id, { balance });

        res.status(200).json({ message: "Balance updated successfully" });
    } catch (error) {
        console.error("Error updating balance:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.put('/update-currency', isAuthenticated, async (req, res) => {
    const { newCurrency } = req.body;

    try {
        const user = await User.findById(req.user._id);
        const transactions = await Transaction.find({ user: req.user.id });
        const oldCurrency = user.currency;
        const exchangeRate = await getExchangeRate(oldCurrency, newCurrency);

        await User.updateOne(
            { _id: req.user._id },
            {
                $set: { currency: newCurrency },
                $mul: { balance: exchangeRate },
            }
        );
        // Update transactions
        transactions.forEach(async (transaction) => {
            transaction.amount = transaction.amount * exchangeRate;
            await transaction.save();
        });

        res.status(200).json({ message: 'Currency updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error: Unable to update currency' });
    }
});

router.get('/user-details', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const transactions = await Transaction.find({ user: req.user._id });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const userDetails = {
            name: user.name,
            email: user.email,
            balance: user.balance,
            transactions: transactions,
        };

        res.status(200).json(userDetails);
    } catch (error) {
        res.status(500).json({ message: 'Server error: Unable to fetch user details' });
    }
});



module.exports = router;
