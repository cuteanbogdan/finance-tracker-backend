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
router.put('/update-transaction/:id', isAuthenticated, async (req, res) => {
    try {
        const { type, date, amount, category, notes } = req.body;
        const updatedTransaction = await Transaction.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id },
            { type, date, amount, category, notes },
            { new: true }
        );

        if (!updatedTransaction) {
            return res.status(404).json({ message: 'Transaction not found' });
        }

        res.status(200).json(updatedTransaction);
    } catch (error) {
        res.status(500).json({ message: 'Server error: Unable to update transaction' });
    }
});

// Delete transaction
router.delete('/delete-transaction/:id', isAuthenticated, async (req, res) => {
    try {
        const deletedTransaction = await Transaction.findOneAndDelete({ _id: req.params.id, user: req.user._id });

        if (!deletedTransaction) {
            return res.status(404).json({ message: 'Transaction not found' });
        }

        // Remove the transaction from the user's transactions array
        await User.updateOne({ _id: req.user._id }, { $pull: { transactions: req.params.id } });

        res.status(200).json(deletedTransaction);
    } catch (error) {
        res.status(500).json({ message: 'Server error: Unable to delete transaction' });
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
        // Fetch the updated user document
        const updatedUser = await User.findById(req.user._id);
        console.log(updatedUser.balance); // This should log the updated balance

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





module.exports = router;
