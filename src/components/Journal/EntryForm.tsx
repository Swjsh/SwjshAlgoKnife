"use client";

import React, { useState } from "react";
import styles from "./EntryForm.module.css";
import GlassPanel from "@/components/UI/GlassPanel";
import { X, Save } from "lucide-react";

interface EntryFormProps {
    onClose: () => void;
    onSuccess: () => void;
}

export default function EntryForm({ onClose, onSuccess }: EntryFormProps) {
    const [formData, setFormData] = useState({
        symbol: "",
        direction: "LONG",
        entry_price: "",
        size: "",
        strategy: "Manual",
        notes: ""
    });
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await fetch("/api/journal", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });
            if (res.ok) {
                onSuccess();
            } else {
                alert("Failed to save trade");
            }
        } catch (err) {
            console.error(err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    return (
        <div className={styles.overlay}>
            <GlassPanel className={styles.modal} title="Log New Trade">
                <button className={styles.closeBtn} onClick={onClose}>
                    <X size={20} />
                </button>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.row}>
                        <div className={styles.group}>
                            <label className={styles.label}>Symbol</label>
                            <input name="symbol" value={formData.symbol} onChange={handleChange} className={styles.input} placeholder="e.g. BTC/USD" required />
                        </div>
                        <div className={styles.group}>
                            <label className={styles.label}>Direction</label>
                            <select name="direction" value={formData.direction} onChange={handleChange} className={styles.select}>
                                <option value="LONG">LONG</option>
                                <option value="SHORT">SHORT</option>
                            </select>
                        </div>
                    </div>

                    <div className={styles.row}>
                        <div className={styles.group}>
                            <label className={styles.label}>Entry Price</label>
                            <input type="number" step="any" name="entry_price" value={formData.entry_price} onChange={handleChange} className={styles.input} required />
                        </div>
                        <div className={styles.group}>
                            <label className={styles.label}>Size (Units)</label>
                            <input type="number" step="any" name="size" value={formData.size} onChange={handleChange} className={styles.input} required />
                        </div>
                    </div>

                    <div className={styles.group}>
                        <label className={styles.label}>Strategy</label>
                        <select name="strategy" value={formData.strategy} onChange={handleChange} className={styles.select}>
                            <option value="Manual">Manual</option>
                            <option value="ORB 15m">ORB 15m Breakout</option>
                            <option value="Support/Resistance">Support/Resistance</option>
                        </select>
                    </div>

                    <div className={styles.group}>
                        <label className={styles.label}>Notes</label>
                        <textarea name="notes" value={formData.notes} onChange={handleChange} className={styles.textarea} rows={4} placeholder="Execution details..." />
                    </div>

                    <div className={styles.actions}>
                        <button type="button" onClick={onClose} className={styles.cancelBtn}>Cancel</button>
                        <button type="submit" disabled={submitting} className={styles.submitBtn}>
                            <Save size={16} />
                            {submitting ? "Saving..." : "Save Trade"}
                        </button>
                    </div>
                </form>
            </GlassPanel>
        </div>
    );
}
