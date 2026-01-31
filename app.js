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

    // Atualizar gráficos quando abrir a aba overview
    if (tab === 'overview') {
        manager.renderCharts();
    }
}

// Notificações do navegador
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function sendNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
            body: body,
            icon: 'icon-192.png',
            badge: 'icon-192.png'
        });
    }
}

// Verificar contas a vencer (executa a cada hora)
function checkDueDates() {
    const expenses = manager.expenses || [];
    const today = new Date();
    const threeDaysFromNow = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);

    expenses.forEach(expense => {
        if (expense.dueDate) {
            const dueDate = new Date(expense.dueDate);
            if (dueDate >= today && dueDate <= threeDaysFromNow) {
                const daysLeft = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
                sendNotification(
                    '🔔 Conta a Vencer',
                    `${expense.description || expense.category} - R$ ${expense.amount.toFixed(2)} vence em ${daysLeft} dia(s)`
                );
            }
        }
    });
}

// Exportar PDF
function exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const totals = manager.getMonthlyTotals();
    const breakdown = manager.getCategoryBreakdown();

    // Título
    doc.setFontSize(20);
    doc.text('Relatório Financeiro', 105, 20, { align: 'center' });

    // Data
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 105, 30, { align: 'center' });

    // Resumo
    doc.setFontSize(14);
    doc.text('Resumo do Mês', 20, 45);

    doc.setFontSize(11);
    doc.text(`Receitas: R$ ${totals.income.toFixed(2)}`, 20, 55);
    doc.text(`Despesas: R$ ${totals.expenses.toFixed(2)}`, 20, 62);
    doc.text(`Saldo: R$ ${totals.balance.toFixed(2)}`, 20, 69);

    // Tabela de categorias
    if (breakdown.length > 0) {
        const tableData = breakdown.map(item => [
            item.category,
            `R$ ${item.amount.toFixed(2)}`,
            `${item.percentage.toFixed(1)}%`
        ]);

        doc.autoTable({
            startY: 80,
            head: [['Categoria', 'Valor', 'Percentual']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [99, 102, 241] }
        });
    }

    // Despesas detalhadas
    if (manager.expenses.length > 0) {
        const expenseData = manager.expenses.slice(0, 20).map(exp => [
            new Date(exp.date).toLocaleDateString('pt-BR'),
            exp.category,
            exp.description || '-',
            `R$ ${exp.amount.toFixed(2)}`
        ]);

        doc.autoTable({
            startY: doc.lastAutoTable.finalY + 15,
            head: [['Data', 'Categoria', 'Descrição', 'Valor']],
            body: expenseData,
            theme: 'striped',
            headStyles: { fillColor: [239, 68, 68] }
        });
    }

    doc.save('relatorio-financeiro.pdf');
    showToast('📄 PDF exportado com sucesso!');
}

// Exportar Excel
function exportExcel() {
    const wb = XLSX.utils.book_new();

    // Aba: Resumo
    const totals = manager.getMonthlyTotals();
    const summaryData = [
        ['Relatório Financeiro'],
        ['Data:', new Date().toLocaleDateString('pt-BR')],
        [],
        ['Resumo do Mês'],
        ['Receitas:', totals.income],
        ['Despesas:', totals.expenses],
        ['Saldo:', totals.balance]
    ];
    const wsResume = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsResume, 'Resumo');

    // Aba: Despesas
    if (manager.expenses.length > 0) {
        const expenseData = manager.expenses.map(exp => ({
            'Data': new Date(exp.date).toLocaleDateString('pt-BR'),
            'Categoria': exp.category,
            'Descrição': exp.description || '-',
            'Valor': exp.amount,
            'Vencimento': exp.dueDate ? new Date(exp.dueDate).toLocaleDateString('pt-BR') : '-'
        }));
        const wsExpenses = XLSX.utils.json_to_sheet(expenseData);
        XLSX.utils.book_append_sheet(wb, wsExpenses, 'Despesas');
    }

    // Aba: Receitas
    if (manager.income.length > 0) {
        const incomeData = manager.income.map(inc => ({
            'Data': new Date(inc.date).toLocaleDateString('pt-BR'),
            'Categoria': inc.category,
            'Descrição': inc.description || '-',
            'Valor': inc.amount
        }));
        const wsIncome = XLSX.utils.json_to_sheet(incomeData);
        XLSX.utils.book_append_sheet(wb, wsIncome, 'Receitas');
    }

    // Aba: Cartão de Crédito
    if (manager.creditPurchases && manager.creditPurchases.length > 0) {
        const creditData = manager.creditPurchases.map(purchase => ({
            'Data': new Date(purchase.date).toLocaleDateString('pt-BR'),
            'Descrição': purchase.description,
            'Categoria': purchase.category,
            'Valor Total': purchase.totalAmount,
            'Parcelas': purchase.installments,
            'Valor da Parcela': purchase.installmentAmount,
            'Parcelas Pagas': purchase.paidInstallments
        }));
        const wsCredit = XLSX.utils.json_to_sheet(creditData);
        XLSX.utils.book_append_sheet(wb, wsCredit, 'Cartão de Crédito');
    }

    // Aba: Por Categoria
    const breakdown = manager.getCategoryBreakdown();
    if (breakdown.length > 0) {
        const categoryData = breakdown.map(item => ({
            'Categoria': item.category,
            'Valor': item.amount,
            'Percentual': item.percentage.toFixed(1) + '%'
        }));
        const wsCategory = XLSX.utils.json_to_sheet(categoryData);
        XLSX.utils.book_append_sheet(wb, wsCategory, 'Por Categoria');
    }

    XLSX.writeFile(wb, 'relatorio-financeiro.xlsx');
    showToast('📊 Excel exportado com sucesso!');
}

// Sincronização
function generateSyncCode() {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    localStorage.setItem('syncCode', code);
    document.getElementById('syncCode').textContent = code;
    showToast('🔑 Código gerado!');
}

function syncWithCode() {
    const inputCode = document.getElementById('syncCodeInput').value.toUpperCase().trim();

    if (!inputCode) {
        showToast('⚠️ Digite um código válido');
        return;
    }

    // Simular sincronização (em produção, isso seria via servidor)
    const myData = {
        expenses: manager.expenses,
        income: manager.income,
        creditPurchases: manager.creditPurchases || []
    };

    // Salvar dados com o código
    localStorage.setItem(`sync_${inputCode}`, JSON.stringify(myData));

    // Tentar carregar dados de outro dispositivo
    const otherData = localStorage.getItem(`sync_${inputCode}`);
    if (otherData) {
        const parsed = JSON.parse(otherData);

        // Mesclar dados
        manager.expenses = [...manager.expenses, ...parsed.expenses];
        manager.income = [...manager.income, ...parsed.income];
        manager.creditPurchases = [...(manager.creditPurchases || []), ...(parsed.creditPurchases || [])];

        // Remover duplicatas por ID
        manager.expenses = Array.from(new Map(manager.expenses.map(item => [item.id, item])).values());
        manager.income = Array.from(new Map(manager.income.map(item => [item.id, item])).values());
        manager.creditPurchases = Array.from(new Map((manager.creditPurchases || []).map(item => [item.id, item])).values());

        // Salvar
        manager.saveData('expenses', manager.expenses);
        manager.saveData('income', manager.income);
        manager.saveData('creditPurchases', manager.creditPurchases);

        manager.render();
        showToast('✅ Dados sincronizados!');
    } else {
        showToast('⚠️ Código não encontrado. Certifique-se de que o outro dispositivo gerou o código.');
    }
}

// Finance Manager
class FinanceManager {
    constructor() {
        this.expenses = this.loadData('expenses') || [];
        this.income = this.loadData('income') || [];
        this.creditPurchases = this.loadData('creditPurchases') || [];
        this.expenseFilter = 'all';
        this.incomeFilter = 'all';
        this.charts = {};
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.render();
        requestNotificationPermission();

        // Verificar contas a vencer a cada hora
        setInterval(() => checkDueDates(), 60 * 60 * 1000);
        checkDueDates(); // Verificar imediatamente

        // Carregar código de sync se existir
        const savedCode = localStorage.getItem('syncCode');
        if (savedCode) {
            document.getElementById('syncCode').textContent = savedCode;
        }
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

        document.getElementById('creditForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addCreditPurchase();
        });
    }

    addExpense() {
        const amount = parseFloat(document.getElementById('expenseAmount').value);
        const category = document.getElementById('expenseCategory').value;
        const description = document.getElementById('expenseDescription').value;
        const dueDate = document.getElementById('expenseDueDate').value;

        this.expenses.unshift({
            id: Date.now(),
            amount,
            category,
            description,
            dueDate: dueDate || null,
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

    addCreditPurchase() {
        const totalAmount = parseFloat(document.getElementById('creditAmount').value);
        const installments = parseInt(document.getElementById('creditInstallments').value);
        const category = document.getElementById('creditCategory').value;
        const description = document.getElementById('creditDescription').value;

        const installmentAmount = totalAmount / installments;

        this.creditPurchases.unshift({
            id: Date.now(),
            totalAmount,
            installments,
            installmentAmount,
            category,
            description,
            paidInstallments: 0,
            date: new Date().toISOString()
        });

        this.saveData('creditPurchases', this.creditPurchases);
        this.render();
        document.getElementById('creditForm').reset();
        showToast('✅ Compra no cartão adicionada!');
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

    deleteCreditPurchase(id) {
        if (confirm('Excluir esta compra?')) {
            this.creditPurchases = this.creditPurchases.filter(c => c.id !== id);
            this.saveData('creditPurchases', this.creditPurchases);
            this.render();
            showToast('🗑️ Compra excluída!');
        }
    }

    payInstallment(id) {
        const purchase = this.creditPurchases.find(p => p.id === id);
        if (purchase && purchase.paidInstallments < purchase.installments) {
            purchase.paidInstallments++;
            this.saveData('creditPurchases', this.creditPurchases);
            this.render();
            showToast('✅ Parcela paga!');
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

        // Adicionar parcelas do cartão do mês atual
        const creditExpenses = this.creditPurchases
            .filter(c => c.paidInstallments < c.installments)
            .reduce((sum, c) => sum + c.installmentAmount, 0);

        return {
            expenses: monthlyExpenses + creditExpenses,
            income: monthlyIncome,
            balance: monthlyIncome - (monthlyExpenses + creditExpenses)
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

    renderCharts() {
        const breakdown = this.getCategoryBreakdown();

        // Gráfico de Pizza - Categorias
        const ctxCategory = document.getElementById('categoryChart');
        if (this.charts.category) this.charts.category.destroy();

        if (breakdown.length > 0) {
            this.charts.category = new Chart(ctxCategory, {
                type: 'doughnut',
                data: {
                    labels: breakdown.map(b => b.category),
                    datasets: [{
                        data: breakdown.map(b => b.amount),
                        backgroundColor: [
                            '#ef4444', '#f59e0b', '#10b981', '#3b82f6',
                            '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        }

        // Gráfico de Barras - Evolução
        const ctxEvolution = document.getElementById('evolutionChart');
        if (this.charts.evolution) this.charts.evolution.destroy();

        // Últimos 6 meses
        const months = [];
        const expensesByMonth = [];
        const incomeByMonth = [];

        for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
            const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

            months.push(date.toLocaleDateString('pt-BR', { month: 'short' }));

            const expensesTotal = this.expenses
                .filter(e => {
                    const eDate = new Date(e.date);
                    return eDate >= monthStart && eDate <= monthEnd;
                })
                .reduce((sum, e) => sum + e.amount, 0);

            const incomeTotal = this.income
                .filter(i => {
                    const iDate = new Date(i.date);
                    return iDate >= monthStart && iDate <= monthEnd;
                })
                .reduce((sum, i) => sum + i.amount, 0);

            expensesByMonth.push(expensesTotal);
            incomeByMonth.push(incomeTotal);
        }

        this.charts.evolution = new Chart(ctxEvolution, {
            type: 'bar',
            data: {
                labels: months,
                datasets: [
                    {
                        label: 'Receitas',
                        data: incomeByMonth,
                        backgroundColor: '#10b981'
                    },
                    {
                        label: 'Despesas',
                        data: expensesByMonth,
                        backgroundColor: '#ef4444'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    render() {
        this.renderOverview();
        this.renderExpenses();
        this.renderIncome();
        this.renderCredit();
        this.renderNotifications();
    }

    renderOverview() {
        const totals = this.getMonthlyTotals();

        document.getElementById('summaryIncome').textContent = `R$ ${this.formatShort(totals.income)}`;
        document.getElementById('summaryExpense').textContent = `R$ ${this.formatShort(totals.expenses)}`;
        document.getElementById('summaryBalance').textContent = `R$ ${this.formatShort(totals.balance)}`;

        const balanceEl = document.getElementById('balanceAmount');
        balanceEl.textContent = `R$ ${totals.balance.toFixed(2)}`;
        balanceEl.className = 'balance-amount';
        if (totals.balance > 0) balanceEl.classList.add('positive');
        if (totals.balance < 0) balanceEl.classList.add('negative');

        this.renderCharts();
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
                    ${expense.dueDate ? `<div class="item-date">Vence: ${new Date(expense.dueDate).toLocaleDateString('pt-BR')}</div>` : ''}
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

    renderCredit() {
        const totalCredit = this.creditPurchases
            .filter(c => c.paidInstallments < c.installments)
            .reduce((sum, c) => sum + c.installmentAmount, 0);

        document.getElementById('totalCredit').textContent = `R$ ${totalCredit.toFixed(2)}`;

        const list = document.getElementById('creditList');

        if (this.creditPurchases.length === 0) {
            list.innerHTML = '<div class="empty-state"><div class="empty-icon">💳</div>Nenhuma compra no cartão</div>';
            return;
        }

        list.innerHTML = this.creditPurchases.map(purchase => {
            const remaining = purchase.installments - purchase.paidInstallments;
            const isComplete = remaining === 0;

            return `
                <div class="item">
                    <div class="item-info">
                        <span class="item-category credit">${purchase.category}</span>
                        <div class="item-description">${purchase.description}</div>
                        <div class="item-installment">
                            ${purchase.paidInstallments}/${purchase.installments} parcelas pagas
                            ${!isComplete ? ` - Faltam ${remaining}x de R$ ${purchase.installmentAmount.toFixed(2)}` : ' - ✅ Quitado'}
                        </div>
                        <div class="item-date">${this.formatDate(purchase.date)}</div>
                    </div>
                    <div style="display: flex; align-items: center; flex-direction: column; gap: 8px;">
                        <div class="item-amount">R$ ${purchase.totalAmount.toFixed(2)}</div>
                        ${!isComplete ? `<button class="btn secondary" style="padding: 6px 12px; font-size: 12px; width: auto;" onclick="manager.payInstallment(${purchase.id})">Pagar Parcela</button>` : ''}
                        <button class="delete-btn" onclick="manager.deleteCreditPurchase(${purchase.id})">✕</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderNotifications() {
        const today = new Date();
        const threeDaysFromNow = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
        const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

        const dueSoon = this.expenses.filter(expense => {
            if (!expense.dueDate) return false;
            const dueDate = new Date(expense.dueDate);
            return dueDate >= today && dueDate <= sevenDaysFromNow;
        });

        const list = document.getElementById('notificationsList');

        if (dueSoon.length === 0) {
            list.innerHTML = '<div class="empty-state"><div class="empty-icon">🔔</div>Nenhuma conta a vencer nos próximos 7 dias</div>';
            return;
        }

        list.innerHTML = dueSoon.map(expense => {
            const dueDate = new Date(expense.dueDate);
            const daysLeft = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
            const isUrgent = daysLeft <= 3;

            return `
                <div class="notification-card ${isUrgent ? 'urgent' : ''}">
                    <div class="notification-title">
                        ${isUrgent ? '🚨' : '⚠️'} ${expense.category} - R$ ${expense.amount.toFixed(2)}
                    </div>
                    <div class="notification-text">
                        ${expense.description || 'Sem descrição'}<br>
                        Vence em ${daysLeft} dia(s) - ${dueDate.toLocaleDateString('pt-BR')}
                    </div>
                </div>
            `;
        }).join('');
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
