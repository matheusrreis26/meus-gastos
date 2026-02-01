// ========================================
// MEUS GASTOS v3.0 - APP.JS CORRIGIDO
// Versão Completa e Funcional
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

// Notificações
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

    if (breakdown.length > 0) {
        const tableData = breakdown.map(item => [
            item.category,
            `R$ ${item.amount.toFixed(2)}`,
            `${item.percentage.toFixed(1)}%`
        ]);

        doc.autoTable({
            startY: 85,
            head: [['Categoria', 'Valor', '% do Total']],
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
        showToast('⚠️ Código não encontrado.');
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
// CLASSE FINANCE MANAGER
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

        this.defaultExpenseCategories = [
            '🍔 Alimentação', '🚗 Transporte', '🎮 Lazer', '💊 Saúde',
            '📚 Educação', '🏠 Moradia', '👕 Vestuário', '🧾 Contas',
            '🪐 Saturno', '📦 Outros'
        ];

        this.defaultIncomeCategories = [
            '💼 Salário', '💻 Freelance', '📈 Investimentos', '💵 Outros'
        ];

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

        // Preencher campos de orçamento e reserva
        if (this.monthlyBudget > 0) {
            document.getElementById('monthlyBudget').value = this.monthlyBudget;
        }
        if (this.emergencyReserve > 0) {
            document.getElementById('reserveAmount').value = this.emergencyReserve;
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

        if (expenseSelect) {
            expenseSelect.innerHTML = '<option value="">Selecione...</option>' +
                this.expenseCategories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
        }

        if (incomeSelect) {
            incomeSelect.innerHTML = '<option value="">Selecione...</option>' +
                this.incomeCategories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
        }

        if (paymentSelect) {
            const paymentMethods = this.getAllPaymentMethods();
            paymentSelect.innerHTML = '<option value="">Selecione...</option>' +
                paymentMethods.map(method => `<option value="${method}">${method}</option>`).join('');
        }

        if (goalSelect) {
            goalSelect.innerHTML = '<option value="">Selecione...</option>' +
                this.expenseCategories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
        }
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

        if (expenseList) {
            expenseList.innerHTML = this.expenseCategories.map(cat => {
                const isDefault = this.defaultExpenseCategories.includes(cat);
                const safeCat = cat.replace(/'/g, "\\'");
                return `
                    <div class="category-tag">
                        ${cat}
                        ${!isDefault ? `<button onclick="manager.removeExpenseCategory('${safeCat}')">✕</button>` : ''}
                    </div>
                `;
            }).join('');
        }

        if (incomeList) {
            incomeList.innerHTML = this.incomeCategories.map(cat => {
                const isDefault = this.defaultIncomeCategories.includes(cat);
                const safeCat = cat.replace(/'/g, "\\'");
                return `
                    <div class="category-tag">
                        ${cat}
                        ${!isDefault ? `<button onclick="manager.removeIncomeCategory('${safeCat}')">✕</button>` : ''}
                    </div>
                `;
            }).join('');
        }

        if (cardsList) {
            if (this.creditCards.length === 0) {
                cardsList.innerHTML = '<p style="color: #9ca3af; font-size: 14px;">Nenhum cartão cadastrado</p>';
            } else {
                cardsList.innerHTML = this.creditCards.map(card => {
                    const safeCard = card.replace(/'/g, "\\'");
                    return `
                        <div class="category-tag">
                            ${card}
                            <button onclick="manager.removeCreditCard('${safeCard}')">✕</button>
                        </div>
                    `;
                }).join('');
            }
        }

        if (tagsList) {
            if (this.tags.length === 0) {
                tagsList.innerHTML = '<p style="color: #9ca3af; font-size: 14px;">Nenhuma tag cadastrada</p>';
            } else {
                tagsList.innerHTML = this.tags.map(tag => {
                    const safeTag = tag.replace(/'/g, "\\'");
                    return `
                        <div class="category-tag">
                            🏷️ ${tag}
                            <button onclick="manager.removeTag('${safeTag}')">✕</button>
                        </div>
                    `;
                }).join('');
            }
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
        const preview = document.getElementById('expenseReceiptPreview');
        if (preview) preview.style.display = 'none';
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

    // Metas
    addGoal() {
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
    }

    removeGoal(category) {
        if (confirm(`Remover meta de ${category}?`)) {
            delete this.goals[category];
            this.saveData('goals', this.goals);
            this.renderGoals();
            showToast('🗑️ Meta removida!');
        }
    }

    checkGoals() {
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

            let status = '';
            let progressClass = '';

            if (percentage >= 100) {
                status = 'danger';
                progressClass = 'danger';
            } else if (percentage >= 80) {
                status = 'warning';
                progressClass = 'warning';
            }

            const safeCategory = category.replace(/'/g, "\\'");

            return `
                <div class="goal-card ${status}">
                    <div class="goal-header">
                        <div class="goal-name">${category}</div>
                        <button class="delete-btn" onclick="manager.removeGoal('${safeCategory}')">✕</button>
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
    }

    // Orçamento
    saveMonthlyBudget() {
        const budget = parseFloat(document.getElementById('monthlyBudget').value);

        if (!budget || budget <= 0) {
            showToast('⚠️ Digite um valor válido');
            return;
        }

        this.monthlyBudget = budget;
        this.saveData('monthlyBudget', this.monthlyBudget);
        this.renderBudgetProgress();
        this.renderBudgetOverview();
        this.renderOverview();
        showToast('✅ Orçamento definido!');
    }

    renderBudgetOverview() {
        const container = document.getElementById('budgetOverview');
        if (!container) return;

        if (!this.monthlyBudget || this.monthlyBudget === 0) {
            container.innerHTML = '';
            return;
        }

        const totals = this.getMonthlyTotals();
        const spent = totals.expenses;
        const remaining = this.monthlyBudget - spent;
        const percentage = (spent / this.monthlyBudget) * 100;

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
    }

    renderBudgetProgress() {
        const container = document.getElementById('budgetProgress');
        if (!container) return;

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

        const today = new Date();
        const daysInMonth = new Date(this.selectedYear, this.selectedMonth + 1, 0).getDate();
        const daysPassed = today.getDate();

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
    }

    // Reserva de Emergência
    saveReserve() {
        const amount = parseFloat(document.getElementById('reserveAmount').value);

        if (amount < 0) {
            showToast('⚠️ Digite um valor válido');
            return;
        }

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

        if (document.getElementById('reserveAmount')) {
            document.getElementById('reserveAmount').value = this.emergencyReserve || '';
        }
    }

    getAverageMonthlyExpenses() {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const recentExpenses = this.expenses.filter(e => new Date(e.date) >= sixMonthsAgo);
        const total = recentExpenses.reduce((sum, e) => sum + e.amount, 0);

        return total / 6;
    }

    // Insights
    renderQuickInsights() {
        const container = document.getElementById('quickInsights');
        if (!container) return;

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
    }

    renderTrendsAnalysis() {
        const container = document.getElementById('trendsAnalysis');
        if (!container) return;

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
    }

    generateInsights() {
        const insights = [];

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

        const breakdown = this.getCategoryBreakdown();
        if (breakdown.length > 0) {
            const top = breakdown[0];
            insights.push({
                icon: '🏆',
                title: 'Maior Gasto',
                text: `Sua maior despesa é ${top.category} com R$ ${top.amount.toFixed(2)} (${top.percentage.toFixed(1)}% do total).`
            });
        }

        if (thisMonth.balance > 0) {
            const savingsRate = (thisMonth.balance / thisMonth.income) * 100;
            insights.push({
                icon: '💰',
                title: 'Taxa de Economia',
                text: `Você está economizando ${savingsRate.toFixed(1)}% da sua receita este mês. ${savingsRate >= 20 ? 'Excelente!' : savingsRate >= 10 ? 'Bom trabalho!' : 'Tente economizar mais!'}`
            });
        }

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

        return insights;
    }

    getMonthTotals(year, month) {
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
    }

    // Comparação de Períodos
    quickCompare(period1Type, period2Type) {
        const now = new Date();
        let period1Start, period1End, period2Start, period2End;

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
    }

    compareCustomPeriods() {
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
    }

    comparePeriodsWithPrevious() {
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
    }

    comparePeriodsData(p1Start, p1End, p2Start, p2End) {
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

        const p2Expenses = this.expenses
            .filter

