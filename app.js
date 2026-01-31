// ========================================
// MEUS GASTOS v3.0 - APP.JS PARTE 1
// Funções Base, Service Worker e Utilitários
// ========================================

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

    // Renderizar conteúdo específico da aba
    if (tab === 'overview') {
        manager.renderCharts();
        manager.renderQuickInsights();
    }

    if (tab === 'settings') {
        manager.renderCategoryManagement();
    }

    if (tab === 'cards') {
        manager.renderCardInvoices();
    }

    if (tab === 'goals') {
        manager.renderGoals();
        manager.renderBudgetProgress();
    }

    if (tab === 'reserve') {
        manager.renderReserveProgress();
    }

    if (tab === 'analysis') {
        manager.renderTrendsAnalysis();
    }
}

// Modal de Comprovante
function closeReceiptModal() {
    document.getElementById('receiptModal').classList.remove('show');
}

function showReceiptModal(imageData) {
    document.getElementById('receiptImage').src = imageData;
    document.getElementById('receiptModal').classList.add('show');
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

    // Verificar metas ultrapassadas
    const goals = manager.goals || {};
    const breakdown = manager.getCategoryBreakdown();

    breakdown.forEach(item => {
        if (goals[item.category] && item.amount > goals[item.category]) {
            sendNotification(
                '⚠️ Meta Ultrapassada',
                `${item.category}: R$ ${item.amount.toFixed(2)} (meta: R$ ${goals[item.category].toFixed(2)})`
            );
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
            'Tags': exp.tags ? exp.tags.join(', ') : '-',
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
        creditCards: manager.creditCards,
        tags: manager.tags,
        goals: manager.goals,
        monthlyBudget: manager.monthlyBudget,
        emergencyReserve: manager.emergencyReserve
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

// Filtros
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
// ========================================
// MEUS GASTOS v3.0 - APP.JS PARTE 2
// Classe FinanceManager - Core
// ========================================

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
        this.tags = this.loadData('tags') || [];
        this.goals = this.loadData('goals') || {};
        this.monthlyBudget = this.loadData('monthlyBudget') || 0;
        this.emergencyReserve = this.loadData('emergencyReserve') || 0;

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

        const isCreditCard = paymentMethod.includes('Crédito') || 
                            this.creditCards.some(card => paymentMethod === card);

        if (isCreditCard) {
            installmentsSection.classList.add('show');
        } else {
            installmentsSection.classList.remove('show');
        }
    }

    previewReceipt(event, previewId) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const preview = document.getElementById(previewId);
                preview.style.display = 'block';
                preview.innerHTML = `
                    <p style="font-size: 13px; color: #6b7280; margin-bottom: 8px;">Comprovante anexado:</p>
                    <img src="${e.target.result}" style="max-width: 100%; border-radius: 8px;">
                `;
            };
            reader.readAsDataURL(file);
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
        const goalSelect = document.getElementById('goalCategory');

        expenseSelect.innerHTML = '<option value="">Selecione...</option>' +
            this.expenseCategories.map(cat => `<option value="${cat}">${cat}</option>`).join('');

        incomeSelect.innerHTML = '<option value="">Selecione...</option>' +
            this.incomeCategories.map(cat => `<option value="${cat}">${cat}</option>`).join('');

        const paymentMethods = this.getAllPaymentMethods();
        paymentSelect.innerHTML = '<option value="">Selecione...</option>' +
            paymentMethods.map(method => `<option value="${method}">${method}</option>`).join('');

        goalSelect.innerHTML = '<option value="">Selecione...</option>' +
            this.expenseCategories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    }

    // Gerenciar Categorias
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

    addTag() {
        const input = document.getElementById('newTag');
        const tag = input.value.trim();

        if (!tag) {
            showToast('⚠️ Digite um nome para a tag');
            return;
        }

        if (this.tags.includes(tag)) {
            showToast('⚠️ Tag já existe');
            return;
        }

        this.tags.push(tag);
        this.saveData('tags', this.tags);
        this.renderCategoryManagement();
        input.value = '';
        showToast('✅ Tag adicionada!');
    }

    removeTag(tag) {
        if (confirm(`Remover a tag "${tag}"?`)) {
            this.tags = this.tags.filter(t => t !== tag);
            this.saveData('tags', this.tags);
            this.renderCategoryManagement();
            showToast('🗑️ Tag removida!');
        }
    }

    renderCategoryManagement() {
        const expenseList = document.getElementById('expenseCategoriesList');
        const incomeList = document.getElementById('incomeCategoriesList');
        const cardsList = document.getElementById('creditCardsList');
        const tagsList = document.getElementById('tagsList');

        expenseList.innerHTML = this.expenseCategories.map(cat => {
            const isDefault = this.defaultExpenseCategories.includes(cat);
            return `
                <div class="category-tag">
                    ${cat}
                    ${!isDefault ? `<button onclick="manager.removeExpenseCategory('${cat.replace(/'/g, "\\'")}')">✕</button>` : ''}
                </div>
            `;
        }).join('');

        incomeList.innerHTML = this.incomeCategories.map(cat => {
            const isDefault = this.defaultIncomeCategories.includes(cat);
            return `
                <div class="category-tag">
                    ${cat}
                    ${!isDefault ? `<button onclick="manager.removeIncomeCategory('${cat.replace(/'/g, "\\'")}')">✕</button>` : ''}
                </div>
            `;
        }).join('');

        if (this.creditCards.length === 0) {
            cardsList.innerHTML = '<p style="color: #9ca3af; font-size: 14px;">Nenhum cartão cadastrado</p>';
        } else {
            cardsList.innerHTML = this.creditCards.map(card => `
                <div class="category-tag">
                    ${card}
                    <button onclick="manager.removeCreditCard('${card.replace(/'/g, "\\'")}')">✕</button>
                </div>
            `).join('');
        }

        if (this.tags.length === 0) {
            tagsList.innerHTML = '<p style="color: #9ca3af; font-size: 14px;">Nenhuma tag cadastrada</p>';
        } else {
            tagsList.innerHTML = this.tags.map(tag => `
                <div class="category-tag">
                    🏷️ ${tag}
                    <button onclick="manager.removeTag('${tag.replace(/'/g, "\\'")}')">✕</button>
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
                            tags: expense.tags,
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
        const tagsInput = document.getElementById('expenseTags').value;
        const receiptFile = document.getElementById('expenseReceipt').files[0];

        const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];

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
            tags,
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

        // Processar comprovante
        if (receiptFile) {
            const reader = new FileReader();
            reader.onload = (e) => {
                expense.receipt = e.target.result;
                this.expenses.unshift(expense);
                this.saveData('expenses', this.expenses);
                this.render();
                this.checkGoals();
            };
            reader.readAsDataURL(receiptFile);
        } else {
            this.expenses.unshift(expense);
            this.saveData('expenses', this.expenses);
            this.render();
            this.checkGoals();
        }

        document.getElementById('expenseForm').reset();
        document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('installmentsSection').classList.remove('show');
        document.getElementById('expenseReceiptPreview').style.display = 'none';
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

    clearAllData() {
        if (confirm('⚠️ ATENÇÃO: Isso vai apagar TODOS os seus dados permanentemente. Tem certeza?')) {
            if (confirm('Última confirmação: Realmente deseja apagar tudo?')) {
                localStorage.clear();
                location.reload();
            }
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

    render() {
        this.renderOverview();
        this.renderExpenses();
        this.renderIncome();
        this.renderNotifications();
    }
}
// ========================================
// MEUS GASTOS v3.0 - APP.JS PARTE 3
// Renderizações e Funcionalidades Avançadas
// ========================================

// Continuação da classe FinanceManager

// ===== RENDERIZAÇÕES =====

FinanceManager.prototype.renderOverview = function() {
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

    // Orçamento na visão geral
    this.renderBudgetOverview();

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
};

FinanceManager.prototype.renderExpenses = function() {
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
                ${expense.tags && expense.tags.length > 0 ? expense.tags.map(tag => `<span class="tag-badge">${tag}</span>`).join('') : ''}
                <div class="item-description">${expense.description || 'Sem descrição'}</div>
                ${expense.installments && expense.installments > 1 ? `
                    <div class="item-installment">
                        ${expense.paidInstallments}/${expense.installments} parcelas pagas
                        ${expense.paidInstallments < expense.installments ? ` - Faltam ${expense.installments - expense.paidInstallments}x` : ' - ✅ Quitado'}
                    </div>
                ` : ''}
                <div class="item-date">${this.formatDate(expense.date)}</div>
                ${expense.dueDate ? `<div class="item-date">Vence: ${new Date(expense.dueDate).toLocaleDateString('pt-BR')}</div>` : ''}
                ${expense.receipt ? `<div class="item-date" style="color: #10b981; cursor: pointer;" onclick="showReceiptModal('${expense.receipt}')">📄 Ver comprovante</div>` : ''}
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
};

FinanceManager.prototype.renderIncome = function() {
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
};

FinanceManager.prototype.renderCardInvoices = function() {
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
};

FinanceManager.prototype.renderNotifications = function() {
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
};

FinanceManager.prototype.renderCharts = function() {
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

    // Gráfico de Barras - Evolução (últimos 6 meses)
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
};

// ===== METAS E ORÇAMENTO =====

FinanceManager.prototype.addGoal = function() {
    const category = document.getElementById('goalCategory').value;
    const amount = parseFloat(document.getElementById('goalAmount').value);

    if (!category || !amount) {
        showToast('⚠️ Preencha todos os campos');
        return;
    }

    this.goals[category] = amount;
    this.saveData('goals', this.goals);
    this.renderGoals();

    document.getElementById('goalCategory').value = '';
    document.getElementById('goalAmount').value = '';

    showToast('✅ Meta definida!');
    this.checkGoals();
};

FinanceManager.prototype.removeGoal = function(category) {
    if (confirm(`Remover meta de ${category}?`)) {
        delete this.goals[category];
        this.saveData('goals', this.goals);
        this.renderGoals();
        showToast('🗑️ Meta removida!');
    }
};

FinanceManager.prototype.checkGoals = function() {
    const breakdown = this.getCategoryBreakdown();

    breakdown.forEach(item => {
        if (this.goals[item.category]) {
            const goal = this.goals[item.category];
            const percentage = (item.amount / goal) * 100;

            if (percentage >= 100) {
                showToast(`⚠️ Meta ultrapassada: ${item.category}`);
            } else if (percentage >= 80) {
                showToast(`⚠️ Atenção: ${item.category} em ${percentage.toFixed(0)}% da meta`);
            }
        }
    });
};

FinanceManager.prototype.renderGoals = function() {
    const container = document.getElementById('goalsList');
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

        let status = '';
        let progressClass = '';

        if (percentage >= 100) {
            status = 'danger';
            progressClass = 'danger';
        } else if (percentage >= 80) {
            status = 'warning';
            progressClass = 'warning';
        }

        return `
            <div class="goal-card ${status}">
                <div class="goal-header">
                    <div class="goal-name">${category}</div>
                    <button class="delete-btn" onclick="manager.removeGoal('${category}')">✕</button>
                </div>
                <div class="goal-values">
                    <span>Gasto: R$ ${spentAmount.toFixed(2)}</span>
                    <span>Meta: R$ ${goalAmount.toFixed(2)}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill ${progressClass}" style="width: ${Math.min(percentage, 100)}%"></div>
                </div>
                <div style="text-align: center; margin-top: 8px; font-size: 13px; font-weight: 700; color: ${percentage >= 100 ? '#991b1b' : percentage >= 80 ? '#92400e' : '#166534'};">
                    ${percentage.toFixed(1)}% utilizado
                </div>
            </div>
        `;
    }).join('');
};

FinanceManager.prototype.saveMonthlyBudget = function() {
    const budget = parseFloat(document.getElementById('monthlyBudget').value);

    if (!budget || budget <= 0) {
        showToast('⚠️ Digite um valor válido');
        return;
    }

    this.monthlyBudget = budget;
    this.saveData('monthlyBudget', this.monthlyBudget);
    this.renderBudgetProgress();
    this.renderBudgetOverview();
    showToast('✅ Orçamento definido!');
};

FinanceManager.prototype.renderBudgetOverview = function() {
    const container = document.getElementById('budgetOverview');

    if (!this.monthlyBudget || this.monthlyBudget === 0) {
        container.innerHTML = '';
        return;
    }

    const totals = this.getMonthlyTotals();
    const spent = totals.expenses;
    const remaining = this.monthlyBudget - spent;
    const percentage = (spent / this.monthlyBudget) * 100;

    let statusClass = '';
    if (percentage >= 100) statusClass = 'danger';
    else if (percentage >= 80) statusClass = 'warning';

    container.innerHTML = `
        <div class="balance-card" style="background: ${percentage >= 100 ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : percentage >= 80 ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)'}; color: white;">
            <div class="balance-label" style="color: rgba(255,255,255,0.9);">
                ${remaining >= 0 ? 'Disponível no Orçamento' : 'Orçamento Ultrapassado'}
            </div>
            <div class="balance-amount" style="color: white;">
                R$ ${Math.abs(remaining).toFixed(2)}
            </div>
            <div class="progress-bar" style="background: rgba(255,255,255,0.3); margin-top: 16px;">
                <div class="progress-fill" style="background: white; width: ${Math.min(percentage, 100)}%"></div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 12px; font-size: 13px; opacity: 0.9;">
                <span>Gasto: R$ ${spent.toFixed(2)}</span>
                <span>Orçamento: R$ ${this.monthlyBudget.toFixed(2)}</span>
            </div>
        </div>
    `;
};

FinanceManager.prototype.renderBudgetProgress = function() {
    const container = document.getElementById('budgetProgress');

    if (!this.monthlyBudget || this.monthlyBudget === 0) {
        container.innerHTML = `
            <div class="list-card">
                <div class="form-title">💡 Dica</div>
                <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
                    Defina um orçamento mensal para acompanhar seus gastos e receber alertas quando estiver próximo do limite.
                </p>
            </div>
        `;
        return;
    }

    const totals = this.getMonthlyTotals();
    const spent = totals.expenses;
    const remaining = this.monthlyBudget - spent;
    const percentage = (spent / this.monthlyBudget) * 100;

    // Projeção
    const today = new Date();
    const daysInMonth = new Date(this.selectedYear, this.selectedMonth + 1, 0).getDate();
    const daysPassed = today.getDate();
    const daysRemaining = daysInMonth - daysPassed;

    const dailyAverage = spent / daysPassed;
    const projectedTotal = dailyAverage * daysInMonth;
    const projectedRemaining = this.monthlyBudget - projectedTotal;

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
                    ${percentage.toFixed(1)}% utilizado
                </div>
            </div>

            <div style="margin-top: 20px; padding: 16px; background: #f9fafb; border-radius: 12px;">
                <div style="font-size: 14px; font-weight: 700; margin-bottom: 12px; color: #1f2937;">
                    📈 Projeção para o Fim do Mês
                </div>
                <div style="font-size: 13px; color: #6b7280; line-height: 1.6;">
                    Média diária: <strong>R$ ${dailyAverage.toFixed(2)}</strong><br>
                    Projeção total: <strong style="color: ${projectedRemaining >= 0 ? '#10b981' : '#ef4444'};">R$ ${projectedTotal.toFixed(2)}</strong><br>
                    ${projectedRemaining >= 0 
                        ? `✅ Deve sobrar: <strong style="color: #10b981;">R$ ${projectedRemaining.toFixed(2)}</strong>` 
                        : `⚠️ Pode faltar: <strong style="color: #ef4444;">R$ ${Math.abs(projectedRemaining).toFixed(2)}</strong>`
                    }
                </div>
            </div>
        </div>
    `;
};

// ===== RESERVA DE EMERGÊNCIA =====

FinanceManager.prototype.saveReserve = function() {
    const amount = parseFloat(document.getElementById('reserveAmount').value);

    if (amount < 0) {
        showToast('⚠️ Digite um valor válido');
        return;
    }

    this.emergencyReserve = amount || 0;
    this.saveData('emergencyReserve', this.emergencyReserve);
    this.renderReserveProgress();
    showToast('✅ Reserva atualizada!');
};

FinanceManager.prototype.renderReserveProgress = function() {
    const container = document.getElementById('reserveProgress');

    // Calcular meta (6 meses de despesas)
    const avgExpenses = this.getAverageMonthlyExpenses();
    const goal = avgExpenses * 6;
    const percentage = goal > 0 ? (this.emergencyReserve / goal) * 100 : 0;

    let status = '';
    if (percentage >= 100) status = 'success';
    else if (percentage >= 50) status = 'warning';

    container.innerHTML = `
        <div class="list-card">
            <div class="form-title">💎 Status da Reserva</div>

            <div class="goal-card ${status}">
                <div class="goal-values">
                    <span>Reserva Atual: R$ ${this.emergencyReserve.toFixed(2)}</span>
                    <span>Meta (6 meses): R$ ${goal.toFixed(2)}</span>
                </div>
                <div class="progress-bar" style="margin: 12px 0;">
                    <div class="progress-fill" style="width: ${Math.min(percentage, 100)}%"></div>
                </div>
                <div style="text-align: center; font-size: 14px; font-weight: 700;">
                    ${percentage.toFixed(1)}% da meta alcançada
                </div>
            </div>

            ${percentage >= 100 ? `
                <div class="insight-card" style="margin-top: 16px; background: #d1fae5; border-left-color: #10b981;">
                    <div class="insight-title" style="color: #065f46;">🎉 Parabéns!</div>
                    <div class="insight-text" style="color: #064e3b;">
                        Você atingiu a meta de reserva de emergência! Sua segurança financeira está garantida.
                    </div>
                </div>
            ` : `
                <div style="margin-top: 16px; padding: 16px; background: #fef3c7; border-radius: 12px;">
                    <div style="font-size: 13px; color: #92400e; line-height: 1.6;">
                        💡 <strong>Falta:</strong> R$ ${(goal - this.emergencyReserve).toFixed(2)}<br>
                        ${percentage < 50 ? '⚠️ Continue guardando! Sua reserva ainda está abaixo de 50% da meta.' : '👍 Você está no caminho certo! Continue assim.'}
                    </div>
                </div>
            `}
        </div>
    `;

    // Atualizar campo
    document.getElementById('reserveAmount').value = this.emergencyReserve || '';
};

FinanceManager.prototype.getAverageMonthlyExpenses = function() {
    // Calcular média dos últimos 6 meses
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const recentExpenses = this.expenses.filter(e => new Date(e.date) >= sixMonthsAgo);
    const total = recentExpenses.reduce((sum, e) => sum + e.amount, 0);

    return total / 6;
};

// ===== INSIGHTS E TENDÊNCIAS =====

FinanceManager.prototype.renderQuickInsights = function() {
    const container = document.getElementById('quickInsights');
    const insights = this.generateInsights();

    if (insights.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = insights.slice(0, 2).map(insight => `
        <div class="insight-card">
            <div class="insight-icon">${insight.icon}</div>
            <div class="insight-text">${insight.text}</div>
        </div>
    `).join('');
};

FinanceManager.prototype.renderTrendsAnalysis = function() {
    const container = document.getElementById('trendsAnalysis');
    const insights = this.generateInsights();

    if (insights.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">💡</div>Adicione mais dados para ver análises</div>';
        return;
    }

    container.innerHTML = insights.map(insight => `
        <div class="insight-card">
            <div class="insight-title">${insight.icon} ${insight.title}</div>
            <div class="insight-text">${insight.text}</div>
        </div>
    `).join('');
};

FinanceManager.prototype.generateInsights = function() {
    const insights = [];

    // Comparar com mês anterior
    const thisMonth = this.getMonthlyTotals();
    const lastMonthData = this.getMonthTotals(this.selectedYear, this.selectedMonth - 1);

    if (lastMonthData.expenses > 0) {
        const diff = ((thisMonth.expenses - lastMonthData.expenses) / lastMonthData.expenses) * 100;

        if (Math.abs(diff) > 10) {
            insights.push({
                icon: diff > 0 ? '📈' : '📉',
                title: 'Comparação com Mês Anterior',
                text: `Você está gastando ${Math.abs(diff).toFixed(1)}% ${diff > 0 ? 'a mais' : 'a menos'} que no mês passado.`
            });
        }
    }

    // Categoria com maior gasto
    const breakdown = this.getCategoryBreakdown();
    if (breakdown.length > 0) {
        const top = breakdown[0];
        insights.push({
            icon: '🏆',
            title: 'Maior Gasto',
            text: `Sua maior despesa é ${top.category} com R$ ${top.amount.toFixed(2)} (${top.percentage.toFixed(1)}% do total).`
        });
    }

    // Verificar se está economizando
    if (thisMonth.balance > 0) {
        const savingsRate = (thisMonth.balance / thisMonth.income) * 100;
        insights.push({
            icon: '💰',
            title: 'Taxa de Economia',
            text: `Você está economizando ${savingsRate.toFixed(1)}% da sua receita este mês. ${savingsRate >= 20 ? 'Excelente!' : savingsRate >= 10 ? 'Bom trabalho!' : 'Tente economizar mais!'}`
        });
    }

    // Alerta de orçamento
    if (this.monthlyBudget > 0) {
        const percentage = (thisMonth.expenses / this.monthlyBudget) * 100;
        if (percentage >= 80) {
            insights.push({
                icon: '⚠️',
                title: 'Alerta de Orçamento',
                text: `Você já utilizou ${percentage.toFixed(1)}% do seu orçamento mensal. ${percentage >= 100 ? 'Cuidado, você ultrapassou o limite!' : 'Atenção aos gastos!'}`
            });
        }
    }

    // Tendência de 3 meses
    const last3Months = this.getLast3MonthsExpenses();
    if (last3Months.length === 3) {
        const trend = last3Months[2] - last3Months[0];
        if (Math.abs(trend) > last3Months[0] * 0.15) {
            insights.push({
                icon: trend > 0 ? '📈' : '📉',
                title: 'Tendência Trimestral',
                text: `Seus gastos ${trend > 0 ? 'aumentaram' : 'diminuíram'} ${Math.abs((trend / last3Months[0]) * 100).toFixed(1)}% nos últimos 3 meses.`
            });
        }
    }

    return insights;
};

FinanceManager.prototype.getLast3MonthsExpenses = function() {
    const result = [];

    for (let i = 2; i >= 0; i--) {
        const date = new Date(this.selectedYear, this.selectedMonth - i, 1);
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

        const total = this.expenses
            .filter(e => {
                const eDate = new Date(e.date);
                return eDate >= monthStart && eDate <= monthEnd;
            })
            .reduce((sum, e) => sum + e.amount, 0);

        result.push(total);
    }

    return result;
};

FinanceManager.prototype.getMonthTotals = function(year, month) {
    // Ajustar mês negativo
    if (month < 0) {
        month = 11;
        year--;
    }

    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);

    const expenses = this.expenses
        .filter(e => {
            const eDate = new Date(e.date);
            return eDate >= monthStart && eDate <= monthEnd;
        })
        .reduce((sum, e) => sum + e.amount, 0);

    const income = this.income
        .filter(i => {
            const iDate = new Date(i.date);
            return iDate >= monthStart && iDate <= monthEnd;
        })
        .reduce((sum, i) => sum + i.amount, 0);

    return {
        expenses,
        income,
        balance: income - expenses
    };
};

// Continua na PARTE 4...
// ========================================
// MEUS GASTOS v3.0 - APP.JS PARTE 4 FINAL
// Comparação de Períodos e Inicialização
// ========================================

// ===== COMPARAÇÃO DE PERÍODOS =====

FinanceManager.prototype.quickCompare = function(period1Type, period2Type) {
    const now = new Date();
    let period1Start, period1End, period2Start, period2End;

    // Período 1
    if (period1Type === 'thisMonth') {
        period1Start = new Date(now.getFullYear(), now.getMonth(), 1);
        period1End = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (period1Type === 'last30') {
        period1End = new Date();
        period1Start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (period1Type === 'thisYear') {
        period1Start = new Date(now.getFullYear(), 0, 1);
        period1End = new Date(now.getFullYear(), 11, 31);
    }

    // Período 2
    if (period2Type === 'lastMonth') {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        period2Start = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
        period2End = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);
    } else if (period2Type === 'previous30') {
        period2End = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        period2Start = new Date(period2End.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (period2Type === 'lastYear') {
        period2Start = new Date(now.getFullYear() - 1, 0, 1);
        period2End = new Date(now.getFullYear() - 1, 11, 31);
    }

    this.comparePeriodsData(period1Start, period1End, period2Start, period2End);
};

FinanceManager.prototype.compareCustomPeriods = function() {
    const period1Start = document.getElementById('period1Start').value;
    const period1End = document.getElementById('period1End').value;
    const period2Start = document.getElementById('period2Start').value;
    const period2End = document.getElementById('period2End').value;

    if (!period1Start || !period1End || !period2Start || !period2End) {
        showToast('⚠️ Preencha todas as datas');
        return;
    }

    this.comparePeriodsData(
        new Date(period1Start),
        new Date(period1End),
        new Date(period2Start),
        new Date(period2End)
    );
};

FinanceManager.prototype.comparePeriodsWithPrevious = function() {
    const start = document.getElementById('compareStartDate').value;
    const end = document.getElementById('compareEndDate').value;

    if (!start || !end) {
        showToast('⚠️ Selecione o período');
        return;
    }

    const period1Start = new Date(start);
    const period1End = new Date(end);

    const daysDiff = Math.ceil((period1End - period1Start) / (1000 * 60 * 60 * 24));

    const period2End = new Date(period1Start.getTime() - 24 * 60 * 60 * 1000);
    const period2Start = new Date(period2End.getTime() - daysDiff * 24 * 60 * 60 * 1000);

    this.comparePeriodsData(period1Start, period1End, period2Start, period2End);
};

FinanceManager.prototype.comparePeriodsData = function(p1Start, p1End, p2Start, p2End) {
    // Calcular totais período 1
    const p1Expenses = this.expenses
        .filter(e => {
            const date = new Date(e.date);
            return date >= p1Start && date <= p1End;
        })
        .reduce((sum, e) => sum + e.amount, 0);

    const p1Income = this.income
        .filter(i => {
            const date = new Date(i.date);
            return date >= p1Start && date <= p1End;
        })
        .reduce((sum, i) => sum + i.amount, 0);

    // Calcular totais período 2
    const p2Expenses = this.expenses
        .filter(e => {
            const date = new Date(e.date);
            return date >= p2Start && date <= p2End;
        })
        .reduce((sum, e) => sum + e.amount, 0);

    const p2Income = this.income
        .filter(i => {
            const date = new Date(i.date);
            return date >= p2Start && date <= p2End;
        })
        .reduce((sum, i) => sum + i.amount, 0);

    // Calcular diferenças
    const expensesDiff = p2Expenses > 0 ? ((p1Expenses - p2Expenses) / p2Expenses) * 100 : 0;
    const incomeDiff = p2Income > 0 ? ((p1Income - p2Income) / p2Income) * 100 : 0;
    const balanceDiff = (p1Income - p1Expenses) - (p2Income - p2Expenses);

    // Comparar por categoria
    const p1Categories = this.getCategoryBreakdownForPeriod(p1Start, p1End);
    const p2Categories = this.getCategoryBreakdownForPeriod(p2Start, p2End);

    const categoryComparison = p1Categories.map(cat1 => {
        const cat2 = p2Categories.find(c => c.category === cat1.category);
        const diff = cat2 ? ((cat1.amount - cat2.amount) / cat2.amount) * 100 : 100;

        return {
            category: cat1.category,
            period1: cat1.amount,
            period2: cat2 ? cat2.amount : 0,
            diff
        };
    });

    this.renderComparisonResults({
        period1: {
            start: p1Start,
            end: p1End,
            expenses: p1Expenses,
            income: p1Income,
            balance: p1Income - p1Expenses
        },
        period2: {
            start: p2Start,
            end: p2End,
            expenses: p2Expenses,
            income: p2Income,
            balance: p2Income - p2Expenses
        },
        differences: {
            expenses: expensesDiff,
            income: incomeDiff,
            balance: balanceDiff
        },
        categoryComparison
    });
};

FinanceManager.prototype.getCategoryBreakdownForPeriod = function(start, end) {
    const periodExpenses = this.expenses.filter(e => {
        const date = new Date(e.date);
        return date >= start && date <= end;
    });

    const total = periodExpenses.reduce((sum, e) => sum + e.amount, 0);
    const breakdown = {};

    periodExpenses.forEach(expense => {
        breakdown[expense.category] = (breakdown[expense.category] || 0) + expense.amount;
    });

    return Object.entries(breakdown)
        .map(([category, amount]) => ({
            category,
            amount,
            percentage: total > 0 ? (amount / total * 100) : 0
        }))
        .sort((a, b) => b.amount - a.amount);
};

FinanceManager.prototype.renderComparisonResults = function(data) {
    const container = document.getElementById('comparisonResults');

    const formatPeriod = (start, end) => {
        return `${start.toLocaleDateString('pt-BR')} - ${end.toLocaleDateString('pt-BR')}`;
    };

    container.innerHTML = `
        <div class="list-card">
            <div class="form-title">📊 Resultado da Comparação</div>

            <!-- Resumo Geral -->
            <div class="comparison-grid">
                <div class="comparison-card">
                    <div class="comparison-label">Período 1</div>
                    <div style="font-size: 11px; color: #9ca3af; margin-bottom: 8px;">
                        ${formatPeriod(data.period1.start, data.period1.end)}
                    </div>
                    <div style="font-size: 13px; color: #6b7280; margin-bottom: 4px;">
                        Receitas: <strong style="color: #10b981;">R$ ${data.period1.income.toFixed(2)}</strong>
                    </div>
                    <div style="font-size: 13px; color: #6b7280; margin-bottom: 4px;">
                        Despesas: <strong style="color: #ef4444;">R$ ${data.period1.expenses.toFixed(2)}</strong>
                    </div>
                    <div style="font-size: 14px; font-weight: 700; margin-top: 8px; color: ${data.period1.balance >= 0 ? '#10b981' : '#ef4444'};">
                        Saldo: R$ ${data.period1.balance.toFixed(2)}
                    </div>
                </div>

                <div class="comparison-card">
                    <div class="comparison-label">Período 2</div>
                    <div style="font-size: 11px; color: #9ca3af; margin-bottom: 8px;">
                        ${formatPeriod(data.period2.start, data.period2.end)}
                    </div>
                    <div style="font-size: 13px; color: #6b7280; margin-bottom: 4px;">
                        Receitas: <strong style="color: #10b981;">R$ ${data.period2.income.toFixed(2)}</strong>
                    </div>
                    <div style="font-size: 13px; color: #6b7280; margin-bottom: 4px;">
                        Despesas: <strong style="color: #ef4444;">R$ ${data.period2.expenses.toFixed(2)}</strong>
                    </div>
                    <div style="font-size: 14px; font-weight: 700; margin-top: 8px; color: ${data.period2.balance >= 0 ? '#10b981' : '#ef4444'};">
                        Saldo: R$ ${data.period2.balance.toFixed(2)}
                    </div>
                </div>
            </div>

            <!-- Diferenças -->
            <div style="margin-top: 20px; padding: 16px; background: #f9fafb; border-radius: 12px;">
                <div style="font-size: 14px; font-weight: 700; margin-bottom: 12px; color: #1f2937;">
                    📈 Variações
                </div>

                <div style="margin-bottom: 8px;">
                    <span style="font-size: 13px; color: #6b7280;">Receitas:</span>
                    <span class="comparison-diff ${data.differences.income >= 0 ? 'positive' : 'negative'}" style="margin-left: 8px;">
                        ${data.differences.income >= 0 ? '↑' : '↓'} ${Math.abs(data.differences.income).toFixed(1)}%
                    </span>
                </div>

                <div style="margin-bottom: 8px;">
                    <span style="font-size: 13px; color: #6b7280;">Despesas:</span>
                    <span class="comparison-diff ${data.differences.expenses >= 0 ? 'negative' : 'positive'}" style="margin-left: 8px;">
                        ${data.differences.expenses >= 0 ? '↑' : '↓'} ${Math.abs(data.differences.expenses).toFixed(1)}%
                    </span>
                </div>

                <div>
                    <span style="font-size: 13px; color: #6b7280;">Saldo:</span>
                    <span class="comparison-diff ${data.differences.balance >= 0 ? 'positive' : 'negative'}" style="margin-left: 8px;">
                        ${data.differences.balance >= 0 ? '↑' : '↓'} R$ ${Math.abs(data.differences.balance).toFixed(2)}
                    </span>
                </div>
            </div>

            <!-- Comparação por Categoria -->
            ${data.categoryComparison.length > 0 ? `
                <div style="margin-top: 20px;">
                    <div style="font-size: 14px; font-weight: 700; margin-bottom: 12px; color: #1f2937;">
                        📊 Por Categoria
                    </div>
                    ${data.categoryComparison.map(cat => `
                        <div class="category-item">
                            <div class="category-header">
                                <div class="category-name">${cat.category}</div>
                                <div class="category-stats">
                                    <div style="font-size: 13px; color: #6b7280;">
                                        P1: R$ ${cat.period1.toFixed(2)} | P2: R$ ${cat.period2.toFixed(2)}
                                    </div>
                                    <div class="comparison-diff ${cat.diff >= 0 ? 'negative' : 'positive'}" style="font-size: 12px;">
                                        ${cat.diff >= 0 ? '↑' : '↓'} ${Math.abs(cat.diff).toFixed(1)}%
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            <!-- Insights -->
            <div class="insight-card" style="margin-top: 20px;">
                <div class="insight-title">💡 Análise</div>
                <div class="insight-text">
                    ${this.generateComparisonInsight(data)}
                </div>
            </div>
        </div>
    `;

    showToast('✅ Comparação concluída!');
};

FinanceManager.prototype.generateComparisonInsight = function(data) {
    const insights = [];

    // Análise de despesas
    if (Math.abs(data.differences.expenses) > 10) {
        if (data.differences.expenses > 0) {
            insights.push(`Suas despesas aumentaram ${data.differences.expenses.toFixed(1)}%. Revise seus gastos para identificar o que mudou.`);
        } else {
            insights.push(`Parabéns! Suas despesas diminuíram ${Math.abs(data.differences.expenses).toFixed(1)}%. Continue assim!`);
        }
    }

    // Análise de receitas
    if (Math.abs(data.differences.income) > 10) {
        if (data.differences.income > 0) {
            insights.push(`Suas receitas aumentaram ${data.differences.income.toFixed(1)}%. Ótimo trabalho!`);
        } else {
            insights.push(`Suas receitas diminuíram ${Math.abs(data.differences.income).toFixed(1)}%. Busque novas fontes de renda.`);
        }
    }

    // Análise de saldo
    if (data.differences.balance > 0) {
        insights.push(`Você conseguiu economizar R$ ${data.differences.balance.toFixed(2)} a mais neste período.`);
    } else if (data.differences.balance < 0) {
        insights.push(`Você economizou R$ ${Math.abs(data.differences.balance).toFixed(2)} a menos neste período.`);
    }

    // Categoria com maior variação
    if (data.categoryComparison.length > 0) {
        const maxDiff = data.categoryComparison.reduce((max, cat) => 
            Math.abs(cat.diff) > Math.abs(max.diff) ? cat : max
        );

        if (Math.abs(maxDiff.diff) > 20) {
            insights.push(`A categoria ${maxDiff.category} teve a maior variação: ${maxDiff.diff >= 0 ? 'aumento' : 'redução'} de ${Math.abs(maxDiff.diff).toFixed(1)}%.`);
        }
    }

    return insights.length > 0 ? insights.join('<br><br>') : 'Os períodos são semelhantes em termos de gastos e receitas.';
};

FinanceManager.prototype.setQuickDate = function(type) {
    const now = new Date();
    let start, end;

    if (type === 'thisMonth') {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (type === 'lastMonth') {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (type === 'last3Months') {
        start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (type === 'thisYear') {
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
    } else if (type === 'lastYear') {
        start = new Date(now.getFullYear() - 1, 0, 1);
        end = new Date(now.getFullYear() - 1, 11, 31);
    }

    document.getElementById('compareStartDate').value = start.toISOString().split('T')[0];
    document.getElementById('compareEndDate').value = end.toISOString().split('T')[0];
};

// ===== INICIALIZAÇÃO =====

const manager = new FinanceManager();

// Definir datas padrão para comparação
const today = new Date();
const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
document.getElementById('compareStartDate').value = firstDayOfMonth.toISOString().split('T')[0];
document.getElementById('compareEndDate').value = today.toISOString().split('T')[0];

// Definir datas padrão para comparação customizada
document.getElementById('period1Start').value = firstDayOfMonth.toISOString().split('T')[0];
document.getElementById('period1End').value = today.toISOString().split('T')[0];

const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
document.getElementById('period2Start').value = lastMonthStart.toISOString().split('T')[0];
document.getElementById('period2End').value = lastMonthEnd.toISOString().split('T')[0];

console.log('💰 Meus Gastos v3.0 - Carregado com sucesso!');


