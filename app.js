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

    if (tab === 'overview') {
        manager.renderCharts();
    }

    if (tab === 'settings') {
        manager.renderCategoryManagement();
    }

    if (tab === 'cards') {
        manager.renderCardInvoices();
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

// Verificar contas a vencer
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
    const paymentBreakdown = manager.getPaymentBreakdown();

    doc.setFontSize(20);
    doc.text('Relatório Financeiro', 105, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 105, 30, { align: 'center' });
    doc.text(`Período: ${manager.getMonthYearString()}`, 105, 37, { align: 'center' });

    doc.setFontSize(14);
    doc.text('Resumo do Mês', 20, 50);

    doc.setFontSize(11);
    doc.text(`Receitas: R$ ${totals.income.toFixed(2)}`, 20, 60);
    doc.text(`Despesas: R$ ${totals.expenses.toFixed(2)}`, 20, 67);
    doc.text(`Saldo: R$ ${totals.balance.toFixed(2)}`, 20, 74);

    // Gastos por forma de pagamento
    if (paymentBreakdown.length > 0) {
        const paymentData = paymentBreakdown.map(item => [
            item.method,
            `R$ ${item.amount.toFixed(2)}`,
            `${item.percentage.toFixed(1)}%`
        ]);

        doc.autoTable({
            startY: 85,
            head: [['Forma de Pagamento', 'Valor', '% do Total']],
            body: paymentData,
            theme: 'grid',
            headStyles: { fillColor: [219, 39, 119] }
        });
    }

    // Categorias
    if (breakdown.length > 0) {
        const tableData = breakdown.map(item => [
            item.category,
            `R$ ${item.amount.toFixed(2)}`,
            `${item.percentage.toFixed(1)}%`,
            `${item.percentOfIncome.toFixed(1)}% da receita`
        ]);

        doc.autoTable({
            startY: doc.lastAutoTable ? doc.lastAutoTable.finalY + 15 : 120,
            head: [['Categoria', 'Valor', '% Despesas', '% Receita']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [99, 102, 241] }
        });
    }

    doc.save(`relatorio-${manager.getMonthYearString().replace(' ', '-')}.pdf`);
    showToast('📄 PDF exportado com sucesso!');
}

// Exportar Excel
function exportExcel() {
    const wb = XLSX.utils.book_new();

    const totals = manager.getMonthlyTotals();
    const summaryData = [
        ['Relatório Financeiro'],
        ['Período:', manager.getMonthYearString()],
        ['Data:', new Date().toLocaleDateString('pt-BR')],
        [],
        ['Resumo do Mês'],
        ['Receitas:', totals.income],
        ['Despesas:', totals.expenses],
        ['Saldo:', totals.balance]
    ];
    const wsResume = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsResume, 'Resumo');

    if (manager.expenses.length > 0) {
        const expenseData = manager.getFilteredExpenses().map(exp => ({
            'Data': new Date(exp.date).toLocaleDateString('pt-BR'),
            'Categoria': exp.category,
            'Descrição': exp.description || '-',
            'Forma de Pagamento': exp.paymentMethod || '-',
            'Parcelas': exp.installments ? `${exp.paidInstallments || 0}/${exp.installments}` : '-',
            'Recorrente': exp.recurring ? 'Sim' : 'Não',
            'Valor': exp.amount,
            'Vencimento': exp.dueDate ? new Date(exp.dueDate).toLocaleDateString('pt-BR') : '-'
        }));
        const wsExpenses = XLSX.utils.json_to_sheet(expenseData);
        XLSX.utils.book_append_sheet(wb, wsExpenses, 'Despesas');
    }

    if (manager.income.length > 0) {
        const incomeData = manager.getFilteredIncome().map(inc => ({
            'Data': new Date(inc.date).toLocaleDateString('pt-BR'),
            'Categoria': inc.category,
            'Descrição': inc.description || '-',
            'Recorrente': inc.recurring ? 'Sim' : 'Não',
            'Valor': inc.amount
        }));
        const wsIncome = XLSX.utils.json_to_sheet(incomeData);
        XLSX.utils.book_append_sheet(wb, wsIncome, 'Receitas');
    }

    const paymentBreakdown = manager.getPaymentBreakdown();
    if (paymentBreakdown.length > 0) {
        const paymentData = paymentBreakdown.map(item => ({
            'Forma de Pagamento': item.method,
            'Valor': item.amount,
            'Percentual': item.percentage.toFixed(1) + '%'
        }));
        const wsPayment = XLSX.utils.json_to_sheet(paymentData);
        XLSX.utils.book_append_sheet(wb, wsPayment, 'Por Forma de Pagamento');
    }

    const breakdown = manager.getCategoryBreakdown();
    if (breakdown.length > 0) {
        const categoryData = breakdown.map(item => ({
            'Categoria': item.category,
            'Valor': item.amount,
            '% das Despesas': item.percentage.toFixed(1) + '%',
            '% da Receita': item.percentOfIncome.toFixed(1) + '%'
        }));
        const wsCategory = XLSX.utils.json_to_sheet(categoryData);
        XLSX.utils.book_append_sheet(wb, wsCategory, 'Por Categoria');
    }

    XLSX.writeFile(wb, `relatorio-${manager.getMonthYearString().replace(' ', '-')}.xlsx`);
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

    const myData = {
        expenses: manager.expenses,
        income: manager.income,
        expenseCategories: manager.expenseCategories,
        incomeCategories: manager.incomeCategories,
        creditCards: manager.creditCards
    };

    localStorage.setItem(`sync_${inputCode}`, JSON.stringify(myData));

    const otherData = localStorage.getItem(`sync_${inputCode}`);
    if (otherData) {
        const parsed = JSON.parse(otherData);

        manager.expenses = [...manager.expenses, ...parsed.expenses];
        manager.income = [...manager.income, ...parsed.income];

        manager.expenses = Array.from(new Map(manager.expenses.map(item => [item.id, item])).values());
        manager.income = Array.from(new Map(manager.income.map(item => [item.id, item])).values());

        manager.saveData('expenses', manager.expenses);
        manager.saveData('income', manager.income);

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
        this.expenseFilter = 'all';
        this.incomeFilter = 'all';
        this.charts = {};

        this.selectedMonth = new Date().getMonth();
        this.selectedYear = new Date().getFullYear();

        // Categorias padrão
        this.defaultExpenseCategories = [
            '🍔 Alimentação', '🚗 Transporte', '🎮 Lazer', '💊 Saúde',
            '📚 Educação', '🏠 Moradia', '👕 Vestuário', '🧾 Contas',
            '🪐 Saturno', '📦 Outros'
        ];

        this.defaultIncomeCategories = [
            '💼 Salário', '💻 Freelance', '📈 Investimentos', '💵 Outros'
        ];

        // Formas de pagamento padrão
        this.defaultPaymentMethods = [
            '💵 Dinheiro',
            '📱 PIX',
            '💳 Cartão de Débito',
            '💳 Cartão de Crédito'
        ];

        this.expenseCategories = this.loadData('expenseCategories') || [...this.defaultExpenseCategories];
        this.incomeCategories = this.loadData('incomeCategories') || [...this.defaultIncomeCategories];
        this.creditCards = this.loadData('creditCards') || [];

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.processRecurringItems();
        this.populateSelects();
        this.updateMonthDisplay();
        this.render();
        requestNotificationPermission();

        setInterval(() => checkDueDates(), 60 * 60 * 1000);
        checkDueDates();

        const savedCode = localStorage.getItem('syncCode');
        if (savedCode) {
            document.getElementById('syncCode').textContent = savedCode;
        }

        const today = new Date().toISOString().split('T')[0];
        document.getElementById('expenseDate').value = today;
        document.getElementById('incomeDate').value = today;
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

    handlePaymentMethodChange() {
        const paymentMethod = document.getElementById('expensePaymentMethod').value;
        const installmentsSection = document.getElementById('installmentsSection');

        // Mostrar parcelas apenas se for cartão de crédito (personalizado ou genérico)
        const isCreditCard = paymentMethod.includes('Crédito') || 
                            this.creditCards.some(card => paymentMethod === card);

        if (isCreditCard) {
            installmentsSection.classList.add('show');
        } else {
            installmentsSection.classList.remove('show');
        }
    }

    getAllPaymentMethods() {
        return [
            ...this.defaultPaymentMethods,
            ...this.creditCards
        ];
    }

    populateSelects() {
        const expenseSelect = document.getElementById('expenseCategory');
        const incomeSelect = document.getElementById('incomeCategory');
        const paymentSelect = document.getElementById('expensePaymentMethod');

        expenseSelect.innerHTML = '<option value="">Selecione...</option>' +
            this.expenseCategories.map(cat => `<option value="${cat}">${cat}</option>`).join('');

        incomeSelect.innerHTML = '<option value="">Selecione...</option>' +
            this.incomeCategories.map(cat => `<option value="${cat}">${cat}</option>`).join('');

        const paymentMethods = this.getAllPaymentMethods();
        paymentSelect.innerHTML = '<option value="">Selecione...</option>' +
            paymentMethods.map(method => `<option value="${method}">${method}</option>`).join('');
    }

    addExpenseCategory() {
        const input = document.getElementById('newExpenseCategory');
        const category = input.value.trim();

        if (!category) {
            showToast('⚠️ Digite um nome para a categoria');
            return;
        }

        if (this.expenseCategories.includes(category)) {
            showToast('⚠️ Categoria já existe');
            return;
        }

        this.expenseCategories.push(category);
        this.saveData('expenseCategories', this.expenseCategories);
        this.populateSelects();
        this.renderCategoryManagement();
        input.value = '';
        showToast('✅ Categoria adicionada!');
    }

    removeExpenseCategory(category) {
        if (this.defaultExpenseCategories.includes(category)) {
            showToast('⚠️ Não é possível remover categorias padrão');
            return;
        }

        if (confirm(`Remover a categoria "${category}"?`)) {
            this.expenseCategories = this.expenseCategories.filter(c => c !== category);
            this.saveData('expenseCategories', this.expenseCategories);
            this.populateSelects();
            this.renderCategoryManagement();
            showToast('🗑️ Categoria removida!');
        }
    }

    addIncomeCategory() {
        const input = document.getElementById('newIncomeCategory');
        const category = input.value.trim();

        if (!category) {
            showToast('⚠️ Digite um nome para a categoria');
            return;
        }

        if (this.incomeCategories.includes(category)) {
            showToast('⚠️ Categoria já existe');
            return;
        }

        this.incomeCategories.push(category);
        this.saveData('incomeCategories', this.incomeCategories);
        this.populateSelects();
        this.renderCategoryManagement();
        input.value = '';
        showToast('✅ Categoria adicionada!');
    }

    removeIncomeCategory(category) {
        if (this.defaultIncomeCategories.includes(category)) {
            showToast('⚠️ Não é possível remover categorias padrão');
            return;
        }

        if (confirm(`Remover a categoria "${category}"?`)) {
            this.incomeCategories = this.incomeCategories.filter(c => c !== category);
            this.saveData('incomeCategories', this.incomeCategories);
            this.populateSelects();
            this.renderCategoryManagement();
            showToast('🗑️ Categoria removida!');
        }
    }

    addCreditCard() {
        const input = document.getElementById('newCreditCard');
        let cardName = input.value.trim();

        if (!cardName) {
            showToast('⚠️ Digite o nome do cartão');
            return;
        }

        // Adicionar emoji se não tiver
        if (!cardName.includes('💳')) {
            cardName = `💳 ${cardName} Crédito`;
        }

        if (this.creditCards.includes(cardName)) {
            showToast('⚠️ Cartão já existe');
            return;
        }

        this.creditCards.push(cardName);
        this.saveData('creditCards', this.creditCards);
        this.populateSelects();
        this.renderCategoryManagement();
        input.value = '';
        showToast('✅ Cartão adicionado!');
    }

    removeCreditCard(cardName) {
        if (confirm(`Remover o cartão "${cardName}"?`)) {
            this.creditCards = this.creditCards.filter(c => c !== cardName);
            this.saveData('creditCards', this.creditCards);
            this.populateSelects();
            this.renderCategoryManagement();
            showToast('🗑️ Cartão removido!');
        }
    }

    renderCategoryManagement() {
        const expenseList = document.getElementById('expenseCategoriesList');
        const incomeList = document.getElementById('incomeCategoriesList');
        const cardsList = document.getElementById('creditCardsList');

        expenseList.innerHTML = this.expenseCategories.map(cat => {
            const isDefault = this.defaultExpenseCategories.includes(cat);
            return `
                <div class="category-tag">
                    ${cat}
                    ${!isDefault ? `<button onclick="manager.removeExpenseCategory('${cat}')">✕</button>` : ''}
                </div>
            `;
        }).join('');

        incomeList.innerHTML = this.incomeCategories.map(cat => {
            const isDefault = this.defaultIncomeCategories.includes(cat);
            return `
                <div class="category-tag">
                    ${cat}
                    ${!isDefault ? `<button onclick="manager.removeIncomeCategory('${cat}')">✕</button>` : ''}
                </div>
            `;
        }).join('');

        if (this.creditCards.length === 0) {
            cardsList.innerHTML = '<p style="color: #9ca3af; font-size: 14px;">Nenhum cartão cadastrado</p>';
        } else {
            cardsList.innerHTML = this.creditCards.map(card => `
                <div class="category-tag">
                    ${card}
                    <button onclick="manager.removeCreditCard('${card}')">✕</button>
                </div>
            `).join('');
        }
    }

    changeMonth(direction) {
        this.selectedMonth += direction;

        if (this.selectedMonth > 11) {
            this.selectedMonth = 0;
            this.selectedYear++;
        } else if (this.selectedMonth < 0) {
            this.selectedMonth = 11;
            this.selectedYear--;
        }

        this.updateMonthDisplay();
        this.render();
    }

    updateMonthDisplay() {
        const months = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];

        document.getElementById('monthDisplay').textContent = 
            `${months[this.selectedMonth]} ${this.selectedYear}`;
    }

    getMonthYearString() {
        const months = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        return `${months[this.selectedMonth]} ${this.selectedYear}`;
    }

    processRecurringItems() {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        this.expenses.forEach(expense => {
            if (expense.recurring && expense.originalDate) {
                const expenseDate = new Date(expense.originalDate);
                const expenseMonth = expenseDate.getMonth();
                const expenseYear = expenseDate.getFullYear();

                if (expenseYear < currentYear || (expenseYear === currentYear && expenseMonth < currentMonth)) {
                    const existsInCurrentMonth = this.expenses.some(e => 
                        e.recurringParentId === expense.id &&
                        new Date(e.date).getMonth() === currentMonth &&
                        new Date(e.date).getFullYear() === currentYear
                    );

                    if (!existsInCurrentMonth) {
                        const newDate = new Date(currentYear, currentMonth, expenseDate.getDate());
                        this.expenses.push({
                            id: Date.now() + Math.random(),
                            amount: expense.amount,
                            category: expense.category,
                            description: expense.description,
                            paymentMethod: expense.paymentMethod,
                            installments: expense.installments,
                            dueDate: expense.dueDate ? new Date(currentYear, currentMonth, new Date(expense.dueDate).getDate()).toISOString().split('T')[0] : null,
                            date: newDate.toISOString(),
                            recurring: true,
                            recurringParentId: expense.id
                        });
                    }
                }
            }
        });

        this.income.forEach(income => {
            if (income.recurring && income.originalDate) {
                const incomeDate = new Date(income.originalDate);
                const incomeMonth = incomeDate.getMonth();
                const incomeYear = incomeDate.getFullYear();

                if (incomeYear < currentYear || (incomeYear === currentYear && incomeMonth < currentMonth)) {
                    const existsInCurrentMonth = this.income.some(i => 
                        i.recurringParentId === income.id &&
                        new Date(i.date).getMonth() === currentMonth &&
                        new Date(i.date).getFullYear() === currentYear
                    );

                    if (!existsInCurrentMonth) {
                        const newDate = new Date(currentYear, currentMonth, incomeDate.getDate());
                        this.income.push({
                            id: Date.now() + Math.random(),
                            amount: income.amount,
                            category: income.category,
                            description: income.description,
                            date: newDate.toISOString(),
                            recurring: true,
                            recurringParentId: income.id
                        });
                    }
                }
            }
        });

        this.saveData('expenses', this.expenses);
        this.saveData('income', this.income);
    }

    addExpense() {
        const amount = parseFloat(document.getElementById('expenseAmount').value);
        const category = document.getElementById('expenseCategory').value;
        const paymentMethod = document.getElementById('expensePaymentMethod').value;
        const description = document.getElementById('expenseDescription').value;
        const date = document.getElementById('expenseDate').value;
        const dueDate = document.getElementById('expenseDueDate').value;
        const recurring = document.getElementById('expenseRecurring').checked;

        const isCreditCard = paymentMethod.includes('Crédito') || 
                            this.creditCards.some(card => paymentMethod === card);

        let installments = 1;
        let installmentAmount = amount;

        if (isCreditCard) {
            installments = parseInt(document.getElementById('expenseInstallments').value) || 1;
            installmentAmount = amount / installments;
        }

        const expense = {
            id: Date.now(),
            amount: installmentAmount,
            totalAmount: amount,
            category,
            paymentMethod,
            description,
            dueDate: dueDate || null,
            date: new Date(date).toISOString(),
            recurring,
            installments: isCreditCard ? installments : null,
            paidInstallments: isCreditCard ? 0 : null,
            isCreditPurchase: isCreditCard && installments > 1
        };

        if (recurring) {
            expense.originalDate = expense.date;
        }

        this.expenses.unshift(expense);
        this.saveData('expenses', this.expenses);
        this.render();
        document.getElementById('expenseForm').reset();
        document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('installmentsSection').classList.remove('show');
        showToast('✅ Despesa adicionada!');
    }

    addIncome() {
        const amount = parseFloat(document.getElementById('incomeAmount').value);
        const category = document.getElementById('incomeCategory').value;
        const description = document.getElementById('incomeDescription').value;
        const date = document.getElementById('incomeDate').value;
        const recurring = document.getElementById('incomeRecurring').checked;

        const income = {
            id: Date.now(),
            amount,
            category,
            description,
            date: new Date(date).toISOString(),
            recurring
        };

        if (recurring) {
            income.originalDate = income.date;
        }

        this.income.unshift(income);
        this.saveData('income', this.income);
        this.render();
        document.getElementById('incomeForm').reset();
        document.getElementById('incomeDate').value = new Date().toISOString().split('T')[0];
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

    payInstallment(id) {
        const expense = this.expenses.find(e => e.id === id);
        if (expense && expense.paidInstallments < expense.installments) {
            expense.paidInstallments++;
            this.saveData('expenses', this.expenses);
            this.render();
            showToast('✅ Parcela paga!');
        }
    }

    getFilteredExpenses() {
        return this.expenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            const isInSelectedMonth = 
                expenseDate.getMonth() === this.selectedMonth &&
                expenseDate.getFullYear() === this.selectedYear;

            if (!isInSelectedMonth) return false;

            if (this.expenseFilter === 'recurring') return expense.recurring;
            if (this.expenseFilter === 'oneTime') return !expense.recurring;
            return true;
        });
    }

    getFilteredIncome() {
        return this.income.filter(income => {
            const incomeDate = new Date(income.date);
            const isInSelectedMonth = 
                incomeDate.getMonth() === this.selectedMonth &&
                incomeDate.getFullYear() === this.selectedYear;

            if (!isInSelectedMonth) return false;

            if (this.incomeFilter === 'recurring') return income.recurring;
            if (this.incomeFilter === 'oneTime') return !income.recurring;
            return true;
        });
    }

    getMonthlyTotals() {
        const monthStart = new Date(this.selectedYear, this.selectedMonth, 1);
        const monthEnd = new Date(this.selectedYear, this.selectedMonth + 1, 0);

        const monthlyExpenses = this.expenses
            .filter(e => {
                const eDate = new Date(e.date);
                return eDate >= monthStart && eDate <= monthEnd;
            })
            .reduce((sum, e) => sum + e.amount, 0);

        const monthlyIncome = this.income
            .filter(i => {
                const iDate = new Date(i.date);
                return iDate >= monthStart && iDate <= monthEnd;
            })
            .reduce((sum, i) => sum + i.amount, 0);

        return {
            expenses: monthlyExpenses,
            income: monthlyIncome,
            balance: monthlyIncome - monthlyExpenses
        };
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

        return Object.entries(breakdown)
            .map(([category, amount]) => ({
                category,
                amount,
                percentage: total > 0 ? (amount / total * 100) : 0,
                percentOfIncome: totals.income > 0 ? (amount / totals.income * 100) : 0
            }))
            .sort((a, b) => b.amount - a.amount);
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

        return Object.entries(breakdown)
            .map(([method, amount]) => ({
                method,
                amount,
                percentage: total > 0 ? (amount / total * 100) : 0
            }))
            .sort((a, b) => b.amount - a.amount);
    }

    getCardInvoices() {
        const monthStart = new Date(this.selectedYear, this.selectedMonth, 1);
        const monthEnd = new Date(this.selectedYear, this.selectedMonth + 1, 0);

        const creditExpenses = this.expenses.filter(e => {
            const eDate = new Date(e.date);
            const isInMonth = eDate >= monthStart && eDate <= monthEnd;
            const isCreditCard = e.paymentMethod && 
                               (e.paymentMethod.includes('Crédito') || 
                                this.creditCards.some(card => e.paymentMethod === card));
            return isInMonth && isCreditCard;
        });

        const invoices = {};
        creditExpenses.forEach(expense => {
            const card = expense.paymentMethod;
            if (!invoices[card]) {
                invoices[card] = {
                    card,
                    total: 0,
                    items: []
                };
            }
            invoices[card].total += expense.amount;
            invoices[card].items.push(expense);
        });

        return Object.values(invoices);
    }

    renderCardInvoices() {
        const invoices = this.getCardInvoices();
        const container = document.getElementById('cardInvoices');

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
                <div style="font-size: 13px; color: #78350f; margin-top: 8px;">
                    ${invoice.items.length} compra(s) neste mês
                </div>
                ${invoice.items.map(item => `
                    <div style="padding: 12px 0; border-top: 1px solid #fde68a; margin-top: 8px;">
                        <div style="font-weight: 600; color: #92400e; font-size: 14px;">${item.description || item.category}</div>
                        <div style="display: flex; justify-content: space-between; margin-top: 4px;">
                            <span style="font-size: 12px; color: #78350f;">
                                ${item.installments > 1 ? `${item.paidInstallments}/${item.installments} parcelas` : 'À vista'}
                            </span>
                            <span style="font-weight: 700; color: #f59e0b;">R$ ${item.amount.toFixed(2)}</span>
                        </div>
                        ${item.installments > 1 && item.paidInstallments < item.installments ? `
                            <button class="btn secondary" style="margin-top: 8px; padding: 8px; font-size: 12px;" onclick="manager.payInstallment(${item.id})">
                                Pagar Parcela
                            </button>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        `).join('');
    }

    renderCharts() {
        const breakdown = this.getCategoryBreakdown();

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
                            '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
                            '#06b6d4', '#84cc16'
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

        const ctxEvolution = document.getElementById('evolutionChart');
        if (this.charts.evolution) this.charts.evolution.destroy();

        const months = [];
        const expensesByMonth = [];
        const incomeByMonth = [];

        for (let i = 5; i >= 0; i--) {
            const date = new Date(this.selectedYear, this.selectedMonth - i, 1);
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
        this.renderNotifications();
    }

    renderOverview() {
        const totals = this.getMonthlyTotals();
        const breakdown = this.getCategoryBreakdown();
        const paymentBreakdown = this.getPaymentBreakdown();

        document.getElementById('summaryIncome').textContent = `R$ ${this.formatShort(totals.income)}`;
        document.getElementById('summaryExpense').textContent = `R$ ${this.formatShort(totals.expenses)}`;
        document.getElementById('summaryBalance').textContent = `R$ ${this.formatShort(totals.balance)}`;

        const balanceEl = document.getElementById('balanceAmount');
        balanceEl.textContent = `R$ ${totals.balance.toFixed(2)}`;
        balanceEl.className = 'balance-amount';
        if (totals.balance > 0) balanceEl.classList.add('positive');
        if (totals.balance < 0) balanceEl.classList.add('negative');

        // Gastos por forma de pagamento
        const paymentEl = document.getElementById('paymentBreakdown');
        if (paymentBreakdown.length === 0) {
            paymentEl.innerHTML = '<div class="empty-state"><div class="empty-icon">💳</div>Nenhuma despesa registrada</div>';
        } else {
            paymentEl.innerHTML = paymentBreakdown.map(item => `
                <div class="category-item">
                    <div class="category-header">
                        <div class="category-name">${item.method}</div>
                        <div class="category-stats">
                            <div class="category-amount">R$ ${item.amount.toFixed(2)}</div>
                            <div class="category-percentage">${item.percentage.toFixed(1)}% do total</div>
                        </div>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${Math.min(item.percentage, 100)}%; background: linear-gradient(90deg, #db2777 0%, #be185d 100%);"></div>
                    </div>
                </div>
            `).join('');
        }

        // Percentual sobre receita
        const percentageEl = document.getElementById('percentageBreakdown');
        if (breakdown.length === 0 || totals.income === 0) {
            percentageEl.innerHTML = '<div class="empty-state"><div class="empty-icon">💰</div>Adicione receitas para ver percentuais</div>';
        } else {
            percentageEl.innerHTML = breakdown.map(item => `
                <div class="category-item">
                    <div class="category-header">
                        <div class="category-name">${item.category}</div>
                        <div class="category-stats">
                            <div class="category-amount">R$ ${item.amount.toFixed(2)}</div>
                            <div class="category-percentage">${item.percentOfIncome.toFixed(1)}% da receita</div>
                        </div>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${Math.min(item.percentOfIncome, 100)}%"></div>
                    </div>
                </div>
            `).join('');
        }

        this.renderCharts();
    }

    renderExpenses() {
        const totals = this.getMonthlyTotals();
        document.getElementById('totalExpenses').textContent = `R$ ${totals.expenses.toFixed(2)}`;

        const filtered = this.getFilteredExpenses();
        const list = document.getElementById('expensesList');

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
                    <div class="item-description">${expense.description || 'Sem descrição'}</div>
                    ${expense.installments && expense.installments > 1 ? `
                        <div class="item-installment">
                            ${expense.paidInstallments}/${expense.installments} parcelas pagas
                            ${expense.paidInstallments < expense.installments ? ` - Faltam ${expense.installments - expense.paidInstallments}x` : ' - ✅ Quitado'}
                        </div>
                    ` : ''}
                    <div class="item-date">${this.formatDate(expense.date)}</div>
                    ${expense.dueDate ? `<div class="item-date">Vence: ${new Date(expense.dueDate).toLocaleDateString('pt-BR')}</div>` : ''}
                </div>
                <div style="display: flex; align-items: center; flex-direction: column; gap: 8px;">
                    <div class="item-amount">R$ ${expense.amount.toFixed(2)}</div>
                    ${expense.installments && expense.installments > 1 && expense.paidInstallments < expense.installments ? `
                        <button class="btn secondary" style="padding: 6px 12px; font-size: 12px; width: auto;" onclick="manager.payInstallment(${expense.id})">Pagar Parcela</button>
                    ` : ''}
                    <button class="delete-btn" onclick="manager.deleteExpense(${expense.id})">✕</button>
                </div>
            </div>
        `).join('');
    }

    renderIncome() {
        const totals = this.getMonthlyTotals();
        document.getElementById('totalIncome').textContent = `R$ ${totals.income.toFixed(2)}`;

        const filtered = this.getFilteredIncome();
        const list = document.getElementById('incomeList');

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

    renderNotifications() {
        const today = new Date();
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
        return date.toLocaleDateString('pt-BR');
    }

    formatShort(value) {
        if (value >= 1000) return (value / 1000).toFixed(1) + 'k';
        return value.toFixed(0);
    }

    loadData(key) {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    }

    saveData(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    }
}

const manager = new FinanceManager();

function filterExpenses(filter) {
    document.querySelectorAll('#expenses-tab .filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    manager.expenseFilter = filter;
    manager.renderExpenses();
}

function filterIncome(filter) {
    document.querySelectorAll('#income-tab .filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    manager.incomeFilter = filter;
    manager.renderIncome();
}
