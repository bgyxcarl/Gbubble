
import { Transaction, TxType } from '../types';

// Allow API_URL to be defined by build environment, fallback to localhost for development
// In a React app created with standard tools, process.env.REACT_APP_... is commonly used, 
// or simply standard process.env if using a modern bundler like Vite (import.meta.env) or Parcel.
// Assuming standard Node-style env replacement or fallback.
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export interface Label {
    address: string;
    label: string;
    tag_type: string;
}

export const authService = {
    async login(username: string, password: string): Promise<{ token: string, username: string } | null> {
        try {
            const res = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            if (!res.ok) throw new Error('Login failed');
            return await res.json();
        } catch (e) {
            console.error(e);
            return null;
        }
    },

    async register(username: string, password: string): Promise<boolean> {
        try {
            const res = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            return res.ok;
        } catch (e) {
            console.error(e);
            return false;
        }
    }
};

export const dataService = {
    getHeaders() {
        const token = localStorage.getItem('chainscope_token');
        return { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    },

    async syncTransactions(transactions: Transaction[], type: TxType) {
        try {
            const res = await fetch(`${API_URL}/data/sync`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({ transactions, type })
            });
            return res.ok;
        } catch (e) {
            console.error("Sync failed", e);
            return false;
        }
    },

    async getUserData(): Promise<{ native: Transaction[], erc20: Transaction[] }> {
        try {
            const res = await fetch(`${API_URL}/data`, {
                headers: this.getHeaders()
            });
            if(!res.ok) throw new Error("Fetch failed");
            return await res.json();
        } catch (e) {
            console.error(e);
            return { native: [], erc20: [] };
        }
    },

    async getLabels(): Promise<Label[]> {
        try {
            const res = await fetch(`${API_URL}/labels`, {
                headers: this.getHeaders()
            });
            if(!res.ok) return [];
            return await res.json();
        } catch (e) {
            console.error(e);
            return [];
        }
    },

    async saveLabel(address: string, label: string, tagType: string) {
        try {
            await fetch(`${API_URL}/labels`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({ address, label, tag_type: tagType })
            });
        } catch (e) {
            console.error(e);
        }
    }
};
