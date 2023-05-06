// routes/transactions.js

const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middlewares/auth");

const Transaction = require("../Transaction");
const User = require("../User");

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

        const user = await User.findById(req.user._id);
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
        res.status(200).json(transactions);
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


module.exports = router;
