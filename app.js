// ========================================
// MEUS GASTOS - VERSÃO FUNCIONAL COMPLETA
// ========================================

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(e => console.log('SW error:', e));
}

function showToast(message) {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
}

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    if (event && event.target) {
        event.target.classList.add('active');
    }

    const tabContent = document.getElementById(`${tab}-tab`);
    if (tabContent) {
        tabContent.classList.add('active');
    }

    setTimeout(() => {
        if (tab === 'overview') manager.renderOverview();
        if (tab === 'settings') manager.renderCategoryManagement();
        if (tab === 'cards') manager.renderCardInvoices();
        if (tab === 'goals') { manager.renderGoals(); manager.renderBudgetProgress(); }
        if (tab === 'reserve') manager.renderReserveProgress();
        if (tab === 'analysis') manager.renderTrendsAnalysis();
        if (tab === 'expenses') manager.renderExpenses();
        if (tab === 'income') manager.renderIncome();
        if (tab === 'notifications') manager.renderNotifications();
    }, 10);
}

function closeReceiptModal() {
    const modal = document.getElementById('receiptModal');
    if (modal) modal.classList.remove('show');
}

function showReceiptModal(imageData) {
    const modal = document.getElementById('receiptModal');
    const img = document.getElementById('receiptImage');
    if (modal && img) {
        img.src = imageData;
        modal.classList.add('show');
    }
}

function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function sendNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, icon: 'icon-192.png' });
    }
}

function checkDueDates() {
    if (!manager) return;
    const expenses = manager.expenses || [];
    const today = new Date();
    const threeDaysFromNow = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);

    expenses.forEach(expense => {
        if (expense.dueDate) {
            const dueDate = new Date(expense.dueDate);
            if (dueDate >= today && dueDate <= threeDaysFromNow) {
                const daysLeft = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
                sendNotification('🔔 Conta a Vencer', `${expense.description || expense.category} - R$ ${expense.amount.toFixed(2)} vence em ${daysLeft} dia(s)`);
            }
        }
    });
}

function exportPDF() {
    if (!window.jspdf) {
        showToast('⚠️ Biblioteca PDF não carregada');
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const totals = manager.getMonthlyTotals();

    doc.setFontSize(20);
    doc.text('Relatório Financeiro', 105, 20, { align: 'center' });
    doc.setFontSize(11);
    doc.text(`Receitas: R$ ${totals.income.toFixed(2)}`, 20, 40);
    doc.text(`Despesas: R$ ${totals.expenses.toFixed(2)}`, 20, 50);
    doc.text(`Saldo: R$ ${totals.balance.toFixed(2)}`, 20, 60);

    doc.save('relatorio-financeiro.pdf');
    showToast('📄 PDF exportado!');
}

function exportExcel() {
    if (!window.XLSX) {
        showToast('⚠️ Biblioteca Excel não carregada');
        return;
    }
    const wb = XLSX.utils.book_new();
    const totals = manager.getMonthlyTotals();
    const data = [
        ['Relatório Financeiro'],
        ['Receitas', totals.income],
        ['Despesas', totals.expenses],
        ['Saldo', totals.balance]
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Resumo');
    XLSX.writeFile(wb, 'relatorio-financeiro.xlsx');
    showToast('📊 Excel exportado!');
}

function generateSyncCode() {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    localStorage.setItem('syncCode', code);
    const el = document.getElementById('syncCode');
    if (el) el.textContent = code;
    showToast('🔑 Código gerado!');
}

function syncWithCode() {
    const input = document.getElementById('syncCodeInput');
    if (!input || !input.value.trim()) {
        showToast('⚠️ Digite um código válido');
        return;
    }
    showToast('✅ Sincronização simulada');
}

function filterExpenses(filter) {
    document.querySelectorAll('#expenses-tab .filter-btn').forEach(btn => btn.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
    manager.expenseFilter = filter;
    manager.renderExpenses();
}

function filterIncome(filter) {
    document.querySelectorAll('#income-tab .filter-btn').forEach(btn => btn.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
    manager.incomeFilter = filter;
    manager.renderIncome();
}

class FinanceManager {
    constructor() {
        this.expenses = this.loadData('expenses') || [];
        this.income = this.loadData('income') || [];
        this.expenseFilter = 'all';
        this.incomeFilter = 'all';
        this.charts = {};
        this.selectedMonth = new Date().getMonth();
        this.selectedYear = new Date().getFullYear();

        this.defaultExpenseCategories = ['🍔 Alimentação', '🚗 Transporte', '🎮 Lazer', '💊 Saúde', '📚 Educação', '🏠 Moradia', '👕 Vestuário', '🧾 Contas', '📦 Outros'];
        this.defaultIncomeCategories = ['💼 Salário', '💻 Freelance', '📈 Investimentos', '💵 Outros'];
        this.defaultPaymentMethods = ['💵 Dinheiro', '📱 PIX', '💳 Cartão de Débito', '💳 Cartão de Crédito'];

        this.expenseCategories = this.loadData('expenseCategories') || [...this.defaultExpenseCategories];
        this.incomeCategories = this.loadData('incomeCategories') || [...this.defaultIncomeCategories];
        this.creditCards = this.loadData('creditCards') || [];
        this.tags = this.loadData('tags') || [];
        this.goals = this.loadData('goals') || {};
        this.monthlyBudget = this.loadData('monthlyBudget') || 0;
        this.emergencyReserve = this.loadData('emergencyReserve') || 0;

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.populateSelects();
        this.updateMonthDisplay();
        this.render();
        requestNotificationPermission();
        setInterval(() => checkDueDates(), 60 * 60 * 1000);

        const today = new Date().toISOString().split('T')[0];
        this.setFieldValue('expenseDate', today);
        this.setFieldValue('incomeDate', today);
        this.setFieldValue('monthlyBudget', this.monthlyBudget || '');
        this.setFieldValue('reserveAmount', this.emergencyReserve || '');

        const savedCode = localStorage.getItem('syncCode');
        if (savedCode) this.setFieldValue('syncCode', savedCode);

        console.log('✅ App inicializado - Despesas:', this.expenses.length, 'Receitas:', this.income.length);
    }

    setFieldValue(id, value) {
        const el = document.getElementById(id);
        if (el) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.value = value;
            } else {
                el.textContent = value;
            }
        }
    }

    setupEventListeners() {
        const expenseForm = document.getElementById('expenseForm');
        const incomeForm = document.getElementById('incomeForm');

        if (expenseForm) expenseForm.addEventListener('submit', (e) => { e.preventDefault(); this.addExpense(); });
        if (incomeForm) incomeForm.addEventListener('submit', (e) => { e.preventDefault(); this.addIncome(); });
    }

    handlePaymentMethodChange() {
        const paymentMethod = this.getFieldValue('expensePaymentMethod');
        const installmentsSection = document.getElementById('installmentsSection');
        if (!installmentsSection) return;

        const isCreditCard = paymentMethod.includes('Crédito') || this.creditCards.some(card => paymentMethod === card);
        installmentsSection.classList.toggle('show', isCreditCard);
    }

    getFieldValue(id) {
        const el = document.getElementById(id);
        return el ? el.value : '';
    }

    previewReceipt(event, previewId) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const preview = document.getElementById(previewId);
                if (preview) {
                    preview.style.display = 'block';
                    preview.innerHTML = `<p style="font-size: 13px; color: #6b7280;">Comprovante anexado</p><img src="${e.target.result}" style="max-width: 100%; border-radius: 8px;">`;
                }
            };
            reader.readAsDataURL(file);
        }
    }

    getAllPaymentMethods() {
        return [...this.defaultPaymentMethods, ...this.creditCards];
    }

    populateSelects() {
        this.populateSelect('expenseCategory', this.expenseCategories);
        this.populateSelect('incomeCategory', this.incomeCategories);
        this.populateSelect('expensePaymentMethod', this.getAllPaymentMethods());
        this.populateSelect('goalCategory', this.expenseCategories);
    }

    populateSelect(id, options) {
        const select = document.getElementById(id);
        if (select) {
            select.innerHTML = '<option value="">Selecione...</option>' + options.map(opt => `<option value="${opt}">${opt}</option>`).join('');
        }
    }

    addExpenseCategory() {
        const input = document.getElementById('newExpenseCategory');
        if (!input) return;
        const category = input.value.trim();
        if (!category) { showToast('⚠️ Digite um nome'); return; }
        if (this.expenseCategories.includes(category)) { showToast('⚠️ Já existe'); return; }
        this.expenseCategories.push(category);
        this.saveData('expenseCategories', this.expenseCategories);
        this.populateSelects();
        this.renderCategoryManagement();
        input.value = '';
        showToast('✅ Categoria adicionada!');
    }

    removeExpenseCategory(category) {
        if (this.defaultExpenseCategories.includes(category)) { showToast('⚠️ Não pode remover padrão'); return; }
        if (confirm(`Remover "${category}"?`)) {
            this.expenseCategories = this.expenseCategories.filter(c => c !== category);
            this.saveData('expenseCategories', this.expenseCategories);
            this.populateSelects();
            this.renderCategoryManagement();
            showToast('🗑️ Removida!');
        }
    }

    addIncomeCategory() {
        const input = document.getElementById('newIncomeCategory');
        if (!input) return;
        const category = input.value.trim();
        if (!category) { showToast('⚠️ Digite um nome'); return; }
        if (this.incomeCategories.includes(category)) { showToast('⚠️ Já existe'); return; }
        this.incomeCategories.push(category);
        this.saveData('incomeCategories', this.incomeCategories);
        this.populateSelects();
        this.renderCategoryManagement();
        input.value = '';
        showToast('✅ Categoria adicionada!');
    }

    removeIncomeCategory(category) {
        if (this.defaultIncomeCategories.includes(category)) { showToast('⚠️ Não pode remover padrão'); return; }
        if (confirm(`Remover "${category}"?`)) {
            this.incomeCategories = this.incomeCategories.filter(c => c !== category);
            this.saveData('incomeCategories', this.incomeCategories);
            this.populateSelects();
            this.renderCategoryManagement();
            showToast('🗑️ Removida!');
        }
    }

    addCreditCard() {
        const input = document.getElementById('newCreditCard');
        if (!input) return;
        let cardName = input.value.trim();
        if (!cardName) { showToast('⚠️ Digite o nome do cartão'); return; }
        if (!cardName.includes('💳')) cardName = `💳 ${cardName} Crédito`;
        if (this.creditCards.includes(cardName)) { showToast('⚠️ Já existe'); return; }
        this.creditCards.push(cardName);
        this.saveData('creditCards', this.creditCards);
        this.populateSelects();
        this.renderCategoryManagement();
        input.value = '';
        showToast('✅ Cartão adicionado!');
    }

    removeCreditCard(cardName) {
        if (confirm(`Remover "${cardName}"?`)) {
            this.creditCards = this.creditCards.filter(c => c !== cardName);
            this.saveData('creditCards', this.creditCards);
            this.populateSelects();
            this.renderCategoryManagement();
            showToast('🗑️ Removido!');
        }
    }

    addTag() {
        const input = document.getElementById('newTag');
        if (!input) return;
        const tag = input.value.trim();
        if (!tag) { showToast('⚠️ Digite um nome'); return; }
        if (this.tags.includes(tag)) { showToast('⚠️ Já existe'); return; }
        this.tags.push(tag);
        this.saveData('tags', this.tags);
        this.renderCategoryManagement();
        input.value = '';
        showToast('✅ Tag adicionada!');
    }

    removeTag(tag) {
        if (confirm(`Remover "${tag}"?`)) {
            this.tags = this.tags.filter(t => t !== tag);
            this.saveData('tags', this.tags);
            this.renderCategoryManagement();
            showToast('🗑️ Removida!');
        }
    }

    renderCategoryManagement() {
        this.renderCategoryList('expenseCategoriesList', this.expenseCategories, this.defaultExpenseCategories, 'removeExpenseCategory');
        this.renderCategoryList('incomeCategoriesList', this.incomeCategories, this.defaultIncomeCategories, 'removeIncomeCategory');

        const cardsList = document.getElementById('creditCardsList');
        if (cardsList) {
            cardsList.innerHTML = this.creditCards.length === 0 
                ? '<p style="color: #9ca3af;">Nenhum cartão cadastrado</p>' 
                : this.creditCards.map(card => `<div class="category-tag">${card}<button onclick="manager.removeCreditCard('${this.escapeHtml(card)}')">✕</button></div>`).join('');
        }

        const tagsList = document.getElementById('tagsList');
        if (tagsList) {
            tagsList.innerHTML = this.tags.length === 0 
                ? '<p style="color: #9ca3af;">Nenhuma tag cadastrada</p>' 
                : this.tags.map(tag => `<div class="category-tag">🏷️ ${tag}<button onclick="manager.removeTag('${this.escapeHtml(tag)}')">✕</button></div>`).join('');
        }
    }

    renderCategoryList(containerId, categories, defaults, removeMethod) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = categories.map(cat => {
                const isDefault = defaults.includes(cat);
                return `<div class="category-tag">${cat}${!isDefault ? `<button onclick="manager.${removeMethod}('${this.escapeHtml(cat)}')">✕</button>` : ''}</div>`;
            }).join('');
        }
    }

    escapeHtml(text) {
        return text.replace(/'/g, '&#39;').replace(/"/g, '&quot;');
    }

    changeMonth(direction) {
        this.selectedMonth += direction;
        if (this.selectedMonth > 11) { this.selectedMonth = 0; this.selectedYear++; }
        else if (this.selectedMonth < 0) { this.selectedMonth = 11; this.selectedYear--; }
        this.updateMonthDisplay();
        this.render();
    }

    updateMonthDisplay() {
        const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        this.setFieldValue('monthDisplay', `${months[this.selectedMonth]} ${this.selectedYear}`);
    }

    getMonthYearString() {
        const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        return `${months[this.selectedMonth]} ${this.selectedYear}`;
    }

    addExpense() {
        const amount = parseFloat(this.getFieldValue('expenseAmount'));
        const category = this.getFieldValue('expenseCategory');
        const paymentMethod = this.getFieldValue('expensePaymentMethod');
        const description = this.getFieldValue('expenseDescription');
        const date = this.getFieldValue('expenseDate');
        const dueDate = this.getFieldValue('expenseDueDate');
        const recurring = document.getElementById('expenseRecurring')?.checked || false;
        const tagsInput = this.getFieldValue('expenseTags');

        if (!amount || !category || !date) { showToast('⚠️ Preencha os campos obrigatórios'); return; }

        const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];
        const isCreditCard = paymentMethod.includes('Crédito') || this.creditCards.some(card => paymentMethod === card);

        let installments = 1;
        let installmentAmount = amount;

        if (isCreditCard) {
            installments = parseInt(this.getFieldValue('expenseInstallments')) || 1;
            installmentAmount = amount / installments;
        }

        const expense = {
            id: Date.now() + Math.random(),
            amount: installmentAmount,
            totalAmount: amount,
            category, paymentMethod, description, tags,
            dueDate: dueDate || null,
            date: new Date(date).toISOString(),
            recurring,
            installments: isCreditCard ? installments : null,
            paidInstallments: isCreditCard ? 0 : null
        };

        if (recurring) expense.originalDate = expense.date;

        this.expenses.unshift(expense);
        this.saveData('expenses', this.expenses);
        this.render();

        const form = document.getElementById('expenseForm');
        if (form) form.reset();
        this.setFieldValue('expenseDate', new Date().toISOString().split('T')[0]);

        const installmentsSection = document.getElementById('installmentsSection');
        if (installmentsSection) installmentsSection.classList.remove('show');

        showToast('✅ Despesa adicionada!');
    }

    addIncome() {
        const amount = parseFloat(this.getFieldValue('incomeAmount'));
        const category = this.getFieldValue('incomeCategory');
        const description = this.getFieldValue('incomeDescription');
        const date = this.getFieldValue('incomeDate');
        const recurring = document.getElementById('incomeRecurring')?.checked || false;

        if (!amount || !category || !date) { showToast('⚠️ Preencha os campos obrigatórios'); return; }

        const income = {
            id: Date.now() + Math.random(),
            amount, category, description,
            date: new Date(date).toISOString(),
            recurring
        };

        if (recurring) income.originalDate = income.date;

        this.income.unshift(income);
        this.saveData('income', this.income);
        this.render();

        const form = document.getElementById('incomeForm');
        if (form) form.reset();
        this.setFieldValue('incomeDate', new Date().toISOString().split('T')[0]);

        showToast('✅ Receita adicionada!');
    }

    deleteExpense(id) {
        if (confirm('Excluir?')) {
            this.expenses = this.expenses.filter(e => e.id !== id);
            this.saveData('expenses', this.expenses);
            this.render();
            showToast('🗑️ Excluída!');
        }
    }

    deleteIncome(id) {
        if (confirm('Excluir?')) {
            this.income = this.income.filter(i => i.id !== id);
            this.saveData('income', this.income);
            this.render();
            showToast('🗑️ Excluída!');
        }
    }

    payInstallment(id) {
        const expense = this.expenses.find(e => e.id === id);
        if (expense && expense.paidInstallments < expense.installments) {
            expense.paidInstallments++;
            this.saveData('expenses', this.expenses);
            this.render();
            showToast('✅ Parcela paga!');
        }
    }

    clearAllData() {
        if (confirm('⚠️ Apagar TUDO?')) {
            if (confirm('Última confirmação:')) {
                localStorage.clear();
                location.reload();
            }
        }
    }

    getFilteredExpenses() {
        return this.expenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            const isInMonth = expenseDate.getMonth() === this.selectedMonth && expenseDate.getFullYear() === this.selectedYear;
            if (!isInMonth) return false;
            if (this.expenseFilter === 'recurring') return expense.recurring;
            if (this.expenseFilter === 'oneTime') return !expense.recurring;
            return true;
        });
    }

    getFilteredIncome() {
        return this.income.filter(income => {
            const incomeDate = new Date(income.date);
            const isInMonth = incomeDate.getMonth() === this.selectedMonth && incomeDate.getFullYear() === this.selectedYear;
            if (!isInMonth) return false;
            if (this.incomeFilter === 'recurring') return income.recurring;
            if (this.incomeFilter === 'oneTime') return !income.recurring;
            return true;
        });
    }

    getMonthlyTotals() {
        const monthStart = new Date(this.selectedYear, this.selectedMonth, 1);
        const monthEnd = new Date(this.selectedYear, this.selectedMonth + 1, 0);

        const monthlyExpenses = this.expenses.filter(e => {
            const eDate = new Date(e.date);
            return eDate >= monthStart && eDate <= monthEnd;
        }).reduce((sum, e) => sum + e.amount, 0);

        const monthlyIncome = this.income.filter(i => {
            const iDate = new Date(i.date);
            return iDate >= monthStart && iDate <= monthEnd;
        }).reduce((sum, i) => sum + i.amount, 0);

        return { expenses: monthlyExpenses, income: monthlyIncome, balance: monthlyIncome - monthlyExpenses };
    }

    getCategoryBreakdown() {
        const monthStart = new Date(this.selectedYear, this.selectedMonth, 1);
        const monthEnd = new Date(this.selectedYear, this.selectedMonth + 1, 0);

        const monthlyExpenses = this.expenses.filter(e => {
            const eDate = new Date(e.date);
            return eDate >= monthStart && eDate <= monthEnd;
        });

        const total = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);
        const totals = this.getMonthlyTotals();
        const breakdown = {};

        monthlyExpenses.forEach(expense => {
            breakdown[expense.category] = (breakdown[expense.category] || 0) + expense.amount;
        });

        return Object.entries(breakdown).map(([category, amount]) => ({
            category, amount,
            percentage: total > 0 ? (amount / total * 100) : 0,
            percentOfIncome: totals.income > 0 ? (amount / totals.income * 100) : 0
        })).sort((a, b) => b.amount - a.amount);
    }

    getPaymentBreakdown() {
        const monthStart = new Date(this.selectedYear, this.selectedMonth, 1);
        const monthEnd = new Date(this.selectedYear, this.selectedMonth + 1, 0);

        const monthlyExpenses = this.expenses.filter(e => {
            const eDate = new Date(e.date);
            return eDate >= monthStart && eDate <= monthEnd;
        });

        const total = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);
        const breakdown = {};

        monthlyExpenses.forEach(expense => {
            const method = expense.paymentMethod || '❓ Não especificado';
            breakdown[method] = (breakdown[method] || 0) + expense.amount;
        });

        return Object.entries(breakdown).map(([method, amount]) => ({
            method, amount,
            percentage: total > 0 ? (amount / total * 100) : 0
        })).sort((a, b) => b.amount - a.amount);
    }

    getCardInvoices() {
        const monthStart = new Date(this.selectedYear, this.selectedMonth, 1);
        const monthEnd = new Date(this.selectedYear, this.selectedMonth + 1, 0);

        const creditExpenses = this.expenses.filter(e => {
            const eDate = new Date(e.date);
            const isInMonth = eDate >= monthStart && eDate <= monthEnd;
            const isCreditCard = e.paymentMethod && (e.paymentMethod.includes('Crédito') || this.creditCards.some(card => e.paymentMethod === card));
            return isInMonth && isCreditCard;
        });

        const invoices = {};
        creditExpenses.forEach(expense => {
            const card = expense.paymentMethod;
            if (!invoices[card]) invoices[card] = { card, total: 0, items: [] };
            invoices[card].total += expense.amount;
            invoices[card].items.push(expense);
        });

        return Object.values(invoices);
    }

    addGoal() {
        const category = this.getFieldValue('goalCategory');
        const amount = parseFloat(this.getFieldValue('goalAmount'));
        if (!category || !amount) { showToast('⚠️ Preencha todos os campos'); return; }
        this.goals[category] = amount;
        this.saveData('goals', this.goals);
        this.renderGoals();
        this.setFieldValue('goalCategory', '');
        this.setFieldValue('goalAmount', '');
        showToast('✅ Meta definida!');
    }

    removeGoal(category) {
        if (confirm(`Remover meta de ${category}?`)) {
            delete this.goals[category];
            this.saveData('goals', this.goals);
            this.renderGoals();
            showToast('🗑️ Meta removida!');
        }
    }

    renderGoals() {
        const container = document.getElementById('goalsList');
        if (!container) return;

        const breakdown = this.getCategoryBreakdown();
        const goalsArray = Object.entries(this.goals);

        if (goalsArray.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-icon">🎯</div>Nenhuma meta definida</div>';
            return;
        }

        container.innerHTML = goalsArray.map(([category, goalAmount]) => {
            const spent = breakdown.find(b => b.category === category);
            const spentAmount = spent ? spent.amount : 0;
            const percentage = (spentAmount / goalAmount) * 100;
            let status = '', progressClass = '';
            if (percentage >= 100) { status = 'danger'; progressClass = 'danger'; }
            else if (percentage >= 80) { status = 'warning'; progressClass = 'warning'; }

            return `
                <div class="goal-card ${status}">
                    <div class="goal-header">
                        <div class="goal-name">${category}</div>
                        <button class="delete-btn" onclick="manager.removeGoal('${this.escapeHtml(category)}')">✕</button>
                    </div>
                    <div class="goal-values">
                        <span>Gasto: R$ ${spentAmount.toFixed(2)}</span>
                        <span>Meta: R$ ${goalAmount.toFixed(2)}</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill ${progressClass}" style="width: ${Math.min(percentage, 100)}%"></div>
                    </div>
                    <div style="text-align: center; margin-top: 8px; font-size: 13px; font-weight: 700;">
                        ${percentage.toFixed(1)}% utilizado
                    </div>
                </div>
            `;
        }).join('');
    }

    saveMonthlyBudget() {
        const budget = parseFloat(this.getFieldValue('monthlyBudget'));
        if (!budget || budget <= 0) { showToast('⚠️ Digite um valor válido'); return; }
        this.monthlyBudget = budget;
        this.saveData('monthlyBudget', this.monthlyBudget);
        this.renderBudgetProgress();
        this.renderOverview();
        showToast('✅ Orçamento definido!');
    }

    renderBudgetProgress() {
        const container = document.getElementById('budgetProgress');
        if (!container) return;

        if (!this.monthlyBudget || this.monthlyBudget === 0) {
            container.innerHTML = '<div class="list-card"><p style="color: #6b7280;">Defina um orçamento mensal acima.</p></div>';
            return;
        }

        const totals = this.getMonthlyTotals();
        const spent = totals.expenses;
        const remaining = this.monthlyBudget - spent;
        const percentage = (spent / this.monthlyBudget) * 100;

        container.innerHTML = `
            <div class="list-card">
                <div class="form-title">📊 Status do Orçamento</div>
                <div class="goal-card ${percentage >= 100 ? 'danger' : percentage >= 80 ? 'warning' : ''}">
                    <div class="goal-values">
                        <span>Gasto: R$ ${spent.toFixed(2)}</span>
                        <span>Orçamento: R$ ${this.monthlyBudget.toFixed(2)}</span>
                    </div>
                    <div class="progress-bar" style="margin: 12px 0;">
                        <div class="progress-fill ${percentage >= 100 ? 'danger' : percentage >= 80 ? 'warning' : ''}" style="width: ${Math.min(percentage, 100)}%"></div>
                    </div>
                    <div style="text-align: center; font-size: 14px; font-weight: 700;">
                        ${percentage.toFixed(1)}% utilizado - ${remaining >= 0 ? 'Sobra' : 'Falta'}: R$ ${Math.abs(remaining).toFixed(2)}
                    </div>
                </div>
            </div>
        `;
    }

    saveReserve() {
        const amount = parseFloat(this.getFieldValue('reserveAmount'));
        if (amount < 0) { showToast('⚠️ Valor inválido'); return; }
        this.emergencyReserve = amount || 0;
        this.saveData('emergencyReserve', this.emergencyReserve);
        this.renderReserveProgress();
        showToast('✅ Reserva atualizada!');
    }

    renderReserveProgress() {
        const container = document.getElementById('reserveProgress');
        if (!container) return;

        const avgExpenses = this.getAverageMonthlyExpenses();
        const goal = avgExpenses * 6;
        const percentage = goal > 0 ? (this.emergencyReserve / goal) * 100 : 0;

        container.innerHTML = `
            <div class="list-card">
                <div class="form-title">💎 Status da Reserva</div>
                <div class="goal-card">
                    <div class="goal-values">
                        <span>Reserva: R$ ${this.emergencyReserve.toFixed(2)}</span>
                        <span>Meta (6 meses): R$ ${goal.toFixed(2)}</span>
                    </div>
                    <div class="progress-bar" style="margin: 12px 0;">
                        <div class="progress-fill" style="width: ${Math.min(percentage, 100)}%"></div>
                    </div>
                    <div style="text-align: center; font-size: 14px; font-weight: 700;">
                        ${percentage.toFixed(1)}% da meta - Falta: R$ ${Math.max(0, goal - this.emergencyReserve).toFixed(2)}
                    </div>
                </div>
            </div>
        `;
    }

    getAverageMonthlyExpenses() {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const recentExpenses = this.expenses.filter(e => new Date(e.date) >= sixMonthsAgo);
        const total = recentExpenses.reduce((sum, e) => sum + e.amount, 0);
        return total / 6;
    }

    renderTrendsAnalysis() {
        const container = document.getElementById('trendsAnalysis');
        if (!container) return;
        const insights = this.generateInsights();
        if (insights.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-icon">💡</div>Adicione mais dados</div>';
            return;
        }
        container.innerHTML = insights.map(insight => `
            <div class="insight-card">
                <div class="insight-title">${insight.icon} ${insight.title}</div>
                <div class="insight-text">${insight.text}</div>
            </div>
        `).join('');
    }

    generateInsights() {
        const insights = [];
        const breakdown = this.getCategoryBreakdown();
        if (breakdown.length > 0) {
            const top = breakdown[0];
            insights.push({ icon: '🏆', title: 'Maior Gasto', text: `Sua maior despesa é ${top.category} com R$ ${top.amount.toFixed(2)} (${top.percentage.toFixed(1)}% do total).` });
        }
        const totals = this.getMonthlyTotals();
        if (totals.balance > 0) {
            const savingsRate = (totals.balance / totals.income) * 100;
            insights.push({ icon: '💰', title: 'Taxa de Economia', text: `Você está economizando ${savingsRate.toFixed(1)}% da sua receita este mês.` });
        }
        return insights;
    }

    quickCompare() { showToast('📊 Funcionalidade em desenvolvimento'); }
    compareCustomPeriods() { showToast('📊 Funcionalidade em desenvolvimento'); }
    comparePeriodsWithPrevious() { showToast('📊 Funcionalidade em desenvolvimento'); }
    setQuickDate() { showToast('📅 Funcionalidade em desenvolvimento'); }

    render() {
        this.renderOverview();
        this.renderExpenses();
        this.renderIncome();
        this.renderNotifications();
        this.renderCardInvoices();
    }

    renderOverview() {
        const totals = this.getMonthlyTotals();
        const breakdown = this.getCategoryBreakdown();
        const paymentBreakdown = this.getPaymentBreakdown();

        this.setFieldValue('summaryIncome', `R$ ${this.formatShort(totals.income)}`);
        this.setFieldValue('summaryExpense', `R$ ${this.formatShort(totals.expenses)}`);
        this.setFieldValue('summaryBalance', `R$ ${this.formatShort(totals.balance)}`);

        const balanceEl = document.getElementById('balanceAmount');
        if (balanceEl) {
            balanceEl.textContent = `R$ ${totals.balance.toFixed(2)}`;
            balanceEl.className = 'balance-amount';
            if (totals.balance > 0) balanceEl.classList.add('positive');
            if (totals.balance < 0) balanceEl.classList.add('negative');
        }

        const budgetContainer = document.getElementById('budgetOverview');
        if (budgetContainer && this.monthlyBudget > 0) {
            const spent = totals.expenses;
            const remaining = this.monthlyBudget - spent;
            const percentage = (spent / this.monthlyBudget) * 100;
            budgetContainer.innerHTML = `
                <div class="balance-card" style="background: ${percentage >= 100 ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : percentage >= 80 ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)'}; color: white;">
                    <div class="balance-label" style="color: rgba(255,255,255,0.9);">${remaining >= 0 ? 'Disponível no Orçamento' : 'Orçamento Ultrapassado'}</div>
                    <div class="balance-amount" style="color: white;">R$ ${Math.abs(remaining).toFixed(2)}</div>
                    <div class="progress-bar" style="background: rgba(255,255,255,0.3); margin-top: 16px;">
                        <div style="height: 100%; background: white; width: ${Math.min(percentage, 100)}%"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 12px; font-size: 13px; opacity: 0.9;">
                        <span>Gasto: R$ ${spent.toFixed(2)}</span>
                        <span>Orçamento: R$ ${this.monthlyBudget.toFixed(2)}</span>
                    </div>
                </div>
            `;
        }

        const insightsContainer = document.getElementById('quickInsights');
        if (insightsContainer) {
            const insights = this.generateInsights();
            insightsContainer.innerHTML = insights.length > 0 ? insights.slice(0, 2).map(insight => `
                <div class="insight-card"><div class="insight-icon">${insight.icon}</div><div class="insight-text">${insight.text}</div></div>
            `).join('') : '';
        }

        this.renderBreakdown('paymentBreakdown', paymentBreakdown, 'method', '💳', 'Nenhuma despesa');
        this.renderBreakdown('percentageBreakdown', breakdown, 'category', '💰', 'Adicione receitas', true);
        this.renderCharts();
    }

    renderBreakdown(containerId, data, keyField, emptyIcon, emptyText, showPercentOfIncome = false) {
        const container = document.getElementById(containerId);
        if (!container) return;
        if (data.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-icon">${emptyIcon}</div>${emptyText}</div>`;
            return;
        }
        container.innerHTML = data.map(item => `
            <div class="category-item">
                <div class="category-header">
                    <div class="category-name">${item[keyField]}</div>
                    <div class="category-stats">
                        <div class="category-amount">R$ ${item.amount.toFixed(2)}</div>
                        <div class="category-percentage">${showPercentOfIncome ? item.percentOfIncome.toFixed(1) + '% da receita' : item.percentage.toFixed(1) + '%'}</div>
                    </div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${Math.min(showPercentOfIncome ? item.percentOfIncome : item.percentage, 100)}%${showPercentOfIncome ? '' : '; background: linear-gradient(90deg, #db2777 0%, #be185d 100%);'}"></div>
                </div>
            </div>
        `).join('');
    }

    renderExpenses() {
        const totals = this.getMonthlyTotals();
        this.setFieldValue('totalExpenses', `R$ ${totals.expenses.toFixed(2)}`);
        const filtered = this.getFilteredExpenses();
        const list = document.getElementById('expensesList');
        if (!list) return;
        if (filtered.length === 0) {
            list.innerHTML = '<div class="empty-state"><div class="empty-icon">💸</div>Nenhuma despesa neste período</div>';
            return;
        }
        list.innerHTML = filtered.map(expense => `
            <div class="item">
                <div class="item-info">
                    <span class="item-category">${expense.category}</span>
                    ${expense.recurring ? '<span class="recurring-badge">🔄 Recorrente</span>' : ''}
                    ${expense.paymentMethod ? `<span class="payment-badge">${expense.paymentMethod}</span>` : ''}
                    ${expense.tags && expense.tags.length > 0 ? expense.tags.map(tag => `<span class="tag-badge">${tag}</span>`).join('') : ''}
                    <div class="item-description">${expense.description || 'Sem descrição'}</div>
                    ${expense.installments && expense.installments > 1 ? `<div class="item-installment">${expense.paidInstallments}/${expense.installments} parcelas${expense.paidInstallments < expense.installments ? ` - Faltam ${expense.installments - expense.paidInstallments}x` : ' - ✅ Quitado'}</div>` : ''}
                    <div class="item-date">${this.formatDate(expense.date)}</div>
                    ${expense.dueDate ? `<div class="item-date">Vence: ${new Date(expense.dueDate).toLocaleDateString('pt-BR')}</div>` : ''}
                    ${expense.receipt ? `<div class="item-date" style="color: #10b981; cursor: pointer;" onclick="showReceiptModal('${expense.receipt}')">📄 Ver comprovante</div>` : ''}
                </div>
                <div style="display: flex; align-items: center; flex-direction: column; gap: 8px;">
                    <div class="item-amount">R$ ${expense.amount.toFixed(2)}</div>
                    ${expense.installments && expense.installments > 1 && expense.paidInstallments < expense.installments ? `<button class="btn secondary" style="padding: 6px 12px; font-size: 12px; width: auto;" onclick="manager.payInstallment(${expense.id})">Pagar Parcela</button>` : ''}
                    <button class="delete-btn" onclick="manager.deleteExpense(${expense.id})">✕</button>
                </div>
            </div>
        `).join('');
    }

    renderIncome() {
        const totals = this.getMonthlyTotals();
        this.setFieldValue('totalIncome', `R$ ${totals.income.toFixed(2)}`);
        const filtered = this.getFilteredIncome();
        const list = document.getElementById('incomeList');
        if (!list) return;
        if (filtered.length === 0) {
            list.innerHTML = '<div class="empty-state"><div class="empty-icon">💰</div>Nenhuma receita neste período</div>';
            return;
        }
        list.innerHTML = filtered.map(income => `
            <div class="item">
                <div class="item-info">
                    <span class="item-category income">${income.category}</span>
                    ${income.recurring ? '<span class="recurring-badge">🔄 Recorrente</span>' : ''}
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

    renderCardInvoices() {
        const invoices = this.getCardInvoices();
        const container = document.getElementById('cardInvoices');
        if (!container) return;
        if (invoices.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-icon">💳</div>Nenhuma compra no crédito este mês</div>';
            return;
        }
        container.innerHTML = invoices.map(invoice => `
            <div class="card-invoice">
                <div class="card-invoice-header">
                    <div class="card-name">${invoice.card}</div>
                    <div class="card-total">R$ ${invoice.total.toFixed(2)}</div>
                </div>
                <div style="font-size: 13px; color: #78350f; margin-top: 8px;">${invoice.items.length} compra(s) neste mês</div>
                ${invoice.items.map(item => `
                    <div style="padding: 12px 0; border-top: 1px solid #fde68a; margin-top: 8px;">
                        <div style="font-weight: 600; color: #92400e; font-size: 14px;">${item.description || item.category}</div>
                        <div style="display: flex; justify-content: space-between; margin-top: 4px;">
                            <span style="font-size: 12px; color: #78350f;">${item.installments > 1 ? `${item.paidInstallments}/${item.installments} parcelas` : 'À vista'}</span>
                            <span style="font-weight: 700; color: #f59e0b;">R$ ${item.amount.toFixed(2)}</span>
                        </div>
                        ${item.installments > 1 && item.paidInstallments < item.installments ? `<button class="btn secondary" style="margin-top: 8px; padding: 8px; font-size: 12px;" onclick="manager.payInstallment(${item.id})">Pagar Parcela</button>` : ''}
                    </div>
                `).join('')}
            </div>
        `).join('');
    }

    renderNotifications() {
        const today = new Date();
        const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        const dueSoon = this.expenses.filter(expense => {
            if (!expense.dueDate) return false;
            const dueDate = new Date(expense.dueDate);
            return dueDate >= today && dueDate <= sevenDaysFromNow;
        });
        const list = document.getElementById('notificationsList');
        if (!list) return;
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
                    <div class="notification-title">${isUrgent ? '🚨' : '⚠️'} ${expense.category} - R$ ${expense.amount.toFixed(2)}</div>
                    <div class="notification-text">${expense.description || 'Sem descrição'}<br>Vence em ${daysLeft} dia(s) - ${dueDate.toLocaleDateString('pt-BR')}</div>
                </div>
            `;
        }).join('');
    }

    renderCharts() {
        const breakdown = this.getCategoryBreakdown();
        const ctxCategory = document.getElementById('categoryChart');
        if (ctxCategory) {
            if (this.charts.category) this.charts.category.destroy();
            if (breakdown.length > 0 && window.Chart) {
                this.charts.category = new Chart(ctxCategory, {
                    type: 'doughnut',
                    data: {
                        labels: breakdown.map(b => b.category),
                        datasets: [{ data: breakdown.map(b => b.amount), backgroundColor: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'] }]
                    },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
                });
            }
        }

        const ctxEvolution = document.getElementById('evolutionChart');
        if (ctxEvolution && window.Chart) {
            if (this.charts.evolution) this.charts.evolution.destroy();
            const months = [], expensesByMonth = [], incomeByMonth = [];
            for (let i = 5; i >= 0; i--) {
                const date = new Date(this.selectedYear, this.selectedMonth - i, 1);
                const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
                const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
                months.push(date.toLocaleDateString('pt-BR', { month: 'short' }));
                expensesByMonth.push(this.expenses.filter(e => { const eDate = new Date(e.date); return eDate >= monthStart && eDate <= monthEnd; }).reduce((sum, e) => sum + e.amount, 0));
                incomeByMonth.push(this.income.filter(i => { const iDate = new Date(i.date); return iDate >= monthStart && iDate <= monthEnd; }).reduce((sum, i) => sum + i.amount, 0));
            }
            this.charts.evolution = new Chart(ctxEvolution, {
                type: 'bar',
                data: {
                    labels: months,
                    datasets: [
                        { label: 'Receitas', data: incomeByMonth, backgroundColor: '#10b981' },
                        { label: 'Despesas', data: expensesByMonth, backgroundColor: '#ef4444' }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
            });
        }
    }

    formatDate(dateString) { return new Date(dateString).toLocaleDateString('pt-BR'); }
    formatShort(value) { return value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value.toFixed(0); }
    loadData(key) { const data = localStorage.getItem(key); return data ? JSON.parse(data) : null; }
    saveData(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
}

const manager = new FinanceManager();
console.log('✅ App carregado com sucesso!');
