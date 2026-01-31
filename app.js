// Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(e => console.log('SW error:', e));
}

// Toast
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// Tabs
function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    event.target.classList.add('active');
    document.getElementById(`${tab}-tab`).classList.add('active');
}

// Finance Manager
class FinanceManager {
    constructor() {
        this.expenses = this.loadData('expenses') || [];
        this.income = this.loadData('income') || [];
        this.expenseFilter = 'all';
        this.incomeFilter = 'all';
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.render();
    }

    setupEventListeners() {
        document.getElementById('expenseForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addExpense();
        });

        document.getElementById('incomeForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addIncome();
        });
    }

    addExpense() {
        const amount = parseFloat(document.getElementById('expenseAmount').value);
        const category = document.getElementById('expenseCategory').value;
        const description = document.getElementById('expenseDescription').value;

        this.expenses.unshift({
            id: Date.now(),
            amount,
            category,
            description,
            date: new Date().toISOString()
        });

        this.saveData('expenses', this.expenses);
        this.render();
        document.getElementById('expenseForm').reset();
        showToast('✅ Despesa adicionada!');
    }

    addIncome() {
        const amount = parseFloat(document.getElementById('incomeAmount').value);
        const category = document.getElementById('incomeCategory').value;
        const description = document.getElementById('incomeDescription').value;

        this.income.unshift({
            id: Date.now(),
            amount,
            category,
            description,
            date: new Date().toISOString()
        });

        this.saveData('income', this.income);
        this.render();
        document.getElementById('incomeForm').reset();
        showToast('✅ Receita adicionada!');
    }

    deleteExpense(id) {
        if (confirm('Excluir esta despesa?')) {
            this.expenses = this.expenses.filter(e => e.id !== id);
            this.saveData('expenses', this.expenses);
            this.render();
            showToast('🗑️ Despesa excluída!');
        }
    }

    deleteIncome(id) {
        if (confirm('Excluir esta receita?')) {
            this.income = this.income.filter(i => i.id !== id);
            this.saveData('income', this.income);
            this.render();
            showToast('🗑️ Receita excluída!');
        }
    }

    filterItems(items, filter) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        return items.filter(item => {
            const itemDate = new Date(item.date);
            switch(filter) {
                case 'today': return itemDate >= today;
                case 'week': return itemDate >= weekAgo;
                case 'month': return itemDate >= monthStart;
                default: return true;
            }
        });
    }

    getMonthlyTotals() {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const monthlyExpenses = this.expenses
            .filter(e => new Date(e.date) >= monthStart)
            .reduce((sum, e) => sum + e.amount, 0);

        const monthlyIncome = this.income
            .filter(i => new Date(i.date) >= monthStart)
            .reduce((sum, i) => sum + i.amount, 0);

        return {
            expenses: monthlyExpenses,
            income: monthlyIncome,
            balance: monthlyIncome - monthlyExpenses
        };
    }

    getCategoryBreakdown() {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const monthlyExpenses = this.expenses.filter(e => new Date(e.date) >= monthStart);
        const total = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);

        const breakdown = {};
        monthlyExpenses.forEach(expense => {
            breakdown[expense.category] = (breakdown[expense.category] || 0) + expense.amount;
        });

        return Object.entries(breakdown)
            .map(([category, amount]) => ({
                category,
                amount,
                percentage: total > 0 ? (amount / total * 100) : 0
            }))
            .sort((a, b) => b.amount - a.amount);
    }

    render() {
        this.renderOverview();
        this.renderExpenses();
        this.renderIncome();
    }

    renderOverview() {
        const totals = this.getMonthlyTotals();
        const breakdown = this.getCategoryBreakdown();

        document.getElementById('summaryIncome').textContent = `R$ ${this.formatShort(totals.income)}`;
        document.getElementById('summaryExpense').textContent = `R$ ${this.formatShort(totals.expenses)}`;
        document.getElementById('summaryBalance').textContent = `R$ ${this.formatShort(totals.balance)}`;

        const balanceEl = document.getElementById('balanceAmount');
        balanceEl.textContent = `R$ ${totals.balance.toFixed(2)}`;
        balanceEl.className = 'balance-amount';
        if (totals.balance > 0) balanceEl.classList.add('positive');
        if (totals.balance < 0) balanceEl.classList.add('negative');

        const categoryEl = document.getElementById('categoryBreakdown');
        if (breakdown.length === 0) {
            categoryEl.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div>Nenhuma despesa no mês</div>';
        } else {
            categoryEl.innerHTML = breakdown.map(item => `
                <div class="category-item">
                    <div class="category-header">
                        <div class="category-name">${item.category}</div>
                        <div class="category-stats">
                            <div class="category-amount">R$ ${item.amount.toFixed(2)}</div>
                            <div class="category-percentage">${item.percentage.toFixed(1)}%</div>
                        </div>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${item.percentage}%"></div>
                    </div>
                </div>
            `).join('');
        }

        const percentageEl = document.getElementById('percentageBreakdown');
        if (breakdown.length === 0 || totals.income === 0) {
            percentageEl.innerHTML = '<div class="empty-state"><div class="empty-icon">💰</div>Adicione receitas</div>';
        } else {
            percentageEl.innerHTML = breakdown.map(item => {
                const percentOfIncome = (item.amount / totals.income * 100);
                return `
                    <div class="category-item">
                        <div class="category-header">
                            <div class="category-name">${item.category}</div>
                            <div class="category-stats">
                                <div class="category-amount">R$ ${item.amount.toFixed(2)}</div>
                                <div class="category-percentage">${percentOfIncome.toFixed(1)}% da receita</div>
                            </div>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${Math.min(percentOfIncome, 100)}%"></div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    renderExpenses() {
        const totals = this.getMonthlyTotals();
        document.getElementById('totalExpenses').textContent = `R$ ${totals.expenses.toFixed(2)}`;

        const filtered = this.filterItems(this.expenses, this.expenseFilter);
        const list = document.getElementById('expensesList');

        if (filtered.length === 0) {
            list.innerHTML = '<div class="empty-state"><div class="empty-icon">💸</div>Nenhuma despesa</div>';
            return;
        }

        list.innerHTML = filtered.map(expense => `
            <div class="item">
                <div class="item-info">
                    <span class="item-category">${expense.category}</span>
                    <div class="item-description">${expense.description || 'Sem descrição'}</div>
                    <div class="item-date">${this.formatDate(expense.date)}</div>
                </div>
                <div style="display: flex; align-items: center;">
                    <div class="item-amount">R$ ${expense.amount.toFixed(2)}</div>
                    <button class="delete-btn" onclick="manager.deleteExpense(${expense.id})">✕</button>
                </div>
            </div>
        `).join('');
    }

    renderIncome() {
        const totals = this.getMonthlyTotals();
        document.getElementById('totalIncome').textContent = `R$ ${totals.income.toFixed(2)}`;

        const filtered = this.filterItems(this.income, this.incomeFilter);
        const list = document.getElementById('incomeList');

        if (filtered.length === 0) {
            list.innerHTML = '<div class="empty-state"><div class="empty-icon">💰</div>Nenhuma receita</div>';
            return;
        }

        list.innerHTML = filtered.map(income => `
            <div class="item">
                <div class="item-info">
                    <span class="item-category income">${income.category}</span>
                    <div class="item-description">${income.description || 'Sem descrição'}</div>
                    <div class="item-date">${this.formatDate(income.date)}</div>
                </div>
                <div style="display: flex; align-items: center;">
                    <div class="item-amount income">R$ ${income.amount.toFixed(2)}</div>
                    <button class="delete-btn" onclick="manager.deleteIncome(${income.id})">✕</button>
                </div>
            </div>
        `).join('');
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

        if (date >= today) {
            return `Hoje ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
        } else if (date >= yesterday) {
            return `Ontem ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
        } else {
            return date.toLocaleDateString('pt-BR');
        }
    }

    formatShort(value) {
        if (value >= 1000) return (value / 1000).toFixed(1) + 'k';
        return value.toFixed(0);
    }

    loadData(key) {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    }

    saveData(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    }
}

const manager = new FinanceManager();

function filterExpenses(filter) {
    document.querySelectorAll('#expenses-tab .filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.toLowerCase().includes(filter === 'all' ? 'todos' : filter));
    });
    manager.expenseFilter = filter;
    manager.renderExpenses();
}

function filterIncome(filter) {
    document.querySelectorAll('#income-tab .filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.toLowerCase().includes(filter === 'all' ? 'todos' : filter));
    });
    manager.incomeFilter = filter;
    manager.renderIncome();
}
