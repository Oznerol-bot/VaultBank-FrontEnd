const API_BASE_URL = 'https://vaultbank-7i3m.onrender.com/';
    const TOKEN_KEY = 'vaultBankAuthToken'; 

    function formatCurrency(amount) {
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency: 'PHP',
            minimumFractionDigits: 2
        }).format(amount);
    }

    function showToastMessage(areaId, message, type) {
        const area = document.getElementById(areaId);
        if (area) {
            area.textContent = message;
            area.className = `alert ${type}`;
            area.style.display = 'block';
            setTimeout(() => {
                area.style.display = 'none';
            }, 5000);
        }
    }

    function checkAuthentication(redirectIfAuthenticated = false) {
        const token = localStorage.getItem(TOKEN_KEY);
        const currentPage = window.location.pathname.split('/').pop();

        const authPages = ['login.html', 'signup.html', 'forgot-password.html'];
        const protectedPages = ['dashboard.html', 'transaction.html', 'transac.html', 'log.html', 'settings.html', 'support.html'];

        if (token) {
            if (redirectIfAuthenticated && authPages.includes(currentPage)) {
                window.location.href = 'dashboard.html';
            }
        } else {
            if (protectedPages.includes(currentPage)) {
                window.location.href = 'login.html';
            }
        }
    }


    async function makeApiCall(endpoint, method, data = null) {
        const token = localStorage.getItem(TOKEN_KEY);
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
        };

        const config = {
            method: method,
            headers: headers,
            body: data ? JSON.stringify(data) : null
        };

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
            const responseData = await response.json();

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem(TOKEN_KEY);
                    window.location.href = 'login.html';
                }
                throw new Error(responseData.message || 'API request failed');
            }

            return responseData;
        } catch (error) {
            console.error('API Call Error:', error);
            throw error;
        }
    }

    function handleLogout(event) {
        event.preventDefault();
        localStorage.removeItem(TOKEN_KEY); 
        window.location.href = 'login.html';
    }


    function createTransactionItem(transaction) {
        const isIncome = transaction.type === 'deposit';
        const iconClass = isIncome ? 'fa-arrow-down' : 'fa-arrow-up'; 
        const color = isIncome ? 'var(--success)' : 'var(--danger)';
        const amountSign = isIncome ? '+' : '-';
        const amountClass = isIncome ? 'positive' : 'negative';
        const formattedAmount = formatCurrency(transaction.amount);
        const date = new Date(transaction.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

        let description = transaction.description || `${transaction.type} transaction`;
        if (transaction.type === 'transfer' && transaction.recipientName) {
            description = `Transfer to ${transaction.recipientName}`;
        } else if (transaction.type === 'withdraw') {
            description = `ATM Withdrawal`;
        } else if (transaction.type === 'deposit') {
            description = `Bank Deposit`;
        }

        return `
            <li>
                <div>
                    <i class="fas ${iconClass}" style="color:${color};margin-right:10px;"></i> 
                    ${description}<br>
                    <small>${transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)} - ${date}</small>
                </div>
                <span class="${amountClass}">${amountSign}${formattedAmount}</span>
            </li>
        `;
    }

    async function fetchDashboardData() {
        const loadingText = 'N/A';
        const transactionListElement = document.getElementById('transactionList');
        const accountListElement = document.getElementById('accountList');
        
        try {
            const data = await makeApiCall('/dashboard', 'GET');

            if (!data || !data.user) throw new Error("Invalid dashboard data received.");
            
            const { user, recentTransactions } = data;
            
            document.getElementById('welcomeMessage').textContent = `Welcome Back! ${user.firstName}`;
            
            document.getElementById('totalBalance').textContent = formatCurrency(user.totalBalance);
            document.getElementById('currentBalanceDisplay').textContent = formatCurrency(user.currentBalance);
            document.getElementById('savingsBalanceDisplay').textContent = formatCurrency(user.savingsBalance);
            document.getElementById('investmentBalanceDisplay').textContent = formatCurrency(user.investmentBalance);
            
            accountListElement.innerHTML = `
                <div class="account-item"><small>Current Balance</small><strong>${formatCurrency(user.currentBalance)}</strong></div>
                <div class="account-item"><small>Savings Account</small><strong>${formatCurrency(user.savingsBalance)}</strong></div>
                <div class="account-item"><small>Investment Account</small><strong>${formatCurrency(user.investmentBalance)}</strong></div>
            `;

            if (recentTransactions && recentTransactions.length > 0) {
                const transactionHtml = recentTransactions.map(createTransactionItem).join('');
                transactionListElement.innerHTML = transactionHtml;
            } else {
                transactionListElement.innerHTML = `
                    <li style="text-align:center; padding: 20px 0; color: #999;">
                        No recent transactions to display.
                    </li>
                `;
            }

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            transactionListElement.innerHTML = `
                <li style="text-align:center; padding: 20px 0; color: var(--danger);">
                    Failed to load data. Please try again.
                </li>
            `;
            document.getElementById('totalBalance').textContent = loadingText;
            document.getElementById('currentBalanceDisplay').textContent = loadingText;
            document.getElementById('savingsBalanceDisplay').textContent = loadingText;
            document.getElementById('investmentBalanceDisplay').textContent = loadingText;
            accountListElement.innerHTML = `<div class="account-item"><small>Error</small><strong>${loadingText}</strong></div>`;
        }
    }


    async function fetchTransactions() {
        try {
            const data = await makeApiCall('/transactions', 'GET'); 
            const listElement = document.getElementById('transactions-list');
            const summaryIncome = document.querySelector('.summary-card.income .amount');
            const summaryExpense = document.querySelector('.summary-card.expense .amount');
            const summaryNet = document.querySelector('.summary-card.net .amount');

            if (!data || data.transactions.length === 0) {
                 listElement.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px;">No transactions found.</td></tr>`;
                 summaryIncome.textContent = formatCurrency(0);
                 summaryExpense.textContent = formatCurrency(0);
                 summaryNet.textContent = formatCurrency(0);
                 return;
            }

            let income = 0;
            let expense = 0;
            
            const tableRows = data.transactions.map(t => {
                const isIncome = t.type === 'deposit';
                const amount = isIncome ? t.amount : -t.amount;
                if (isIncome) {
                    income += t.amount;
                } else {
                    expense += t.amount;
                }
                const statusClass = t.status === 'completed' ? 'status-completed' : 'status-pending';

                return `
                    <tr>
                        <td>${new Date(t.createdAt).toLocaleDateString()}</td>
                        <td>${t.id.slice(-6)}</td>
                        <td>${t.type.charAt(0).toUpperCase() + t.type.slice(1)}</td>
                        <td><span class="${statusClass}">${t.status.toUpperCase()}</span></td>
                        <td class="${isIncome ? 'positive' : 'negative'}">${formatCurrency(amount)}</td>
                    </tr>
                `;
            }).join('');

            listElement.innerHTML = tableRows;
            summaryIncome.textContent = '+' + formatCurrency(income);
            summaryExpense.textContent = '-' + formatCurrency(expense);
            summaryNet.textContent = formatCurrency(income - expense);
            
        } catch (error) {
            console.error('Error fetching transactions:', error);
            document.getElementById('transactions-list').innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px; color: var(--danger);">Failed to load transactions.</td></tr>`;
        }
    }


    async function fetchAndPopulateTransactionAccounts() {
        try {
            const data = await makeApiCall('/dashboard', 'GET');

            if (!data || !data.user) throw new Error("Invalid dashboard data received.");

            // Construct accounts list from dashboard data
            const accounts = [
                { name: "Checking Account", id: "CHK", balance: data.user.currentBalance },
                { name: "Savings Account", id: "SAV", balance: data.user.savingsBalance },
                { name: "Investment Account", id: "INV", balance: data.user.investmentBalance },
            ];

            const dropdowns = [
                // Withdraw From: Includes balance and all 3 accounts
                { elementId: 'w-account', includeBalance: true, includeInvestment: true, label: "Withdraw From" },
                // Deposit To: Excludes balance, includes all 3 accounts
                { elementId: 'd-account', includeBalance: false, includeInvestment: true, label: "Deposit To" },
                // Send From (Transfer): Includes balance, EXCLUDES Investment Account
                { elementId: 'sourceAccount', includeBalance: true, includeInvestment: false, label: "Send From" }
            ];

            dropdowns.forEach(({ elementId, includeBalance, includeInvestment, label }) => {
                const element = document.getElementById(elementId);
                if (!element) return;

                element.innerHTML = '';
                
                // Add default disabled placeholder option
                const defaultOption = document.createElement('option');
                defaultOption.textContent = `-- Select ${label} --`;
                defaultOption.value = "";
                defaultOption.disabled = true;
                defaultOption.selected = true;
                element.appendChild(defaultOption);

                accounts.forEach(account => {
                    // Skip Investment Account for the 'Send From' dropdown
                    if (!includeInvestment && account.name === "Investment Account") {
                        return;
                    }

                    const option = document.createElement('option');
                    let textContent = account.name;
                    
                    if (includeBalance) {
                        textContent += ` (${formatCurrency(account.balance)})`;
                    }
                    
                    option.textContent = textContent;
                    option.value = account.id; // Use a unique ID (like CHK) as the value
                    element.appendChild(option);
                });
            });

        } catch (error) {
            console.error('Error fetching account data for transactions:', error);
            // Show user-facing error message in the dropdowns
            const selectElements = ['w-account', 'd-account', 'sourceAccount'];
            selectElements.forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    element.innerHTML = `<option disabled selected>Failed to load accounts</option>`;
                }
            });
        }
    }

    function updateTransferFields(activeType) {
        const bankFields = document.getElementById('recipient-bank-fields');
        const idFields = document.getElementById('recipient-id-fields');

        const toggleRequired = (fieldGroup, isRequired) => {
            fieldGroup.querySelectorAll('input, select').forEach(field => {
                if (isRequired) {
                    field.setAttribute('required', 'required');
                } else {
                    field.removeAttribute('required');
                }
            });
        };

        if (activeType === 'bank') {
            bankFields.style.display = 'block';
            idFields.style.display = 'none';
            toggleRequired(bankFields, true);
            toggleRequired(idFields, false);
        } else { 
            bankFields.style.display = 'none';
            idFields.style.display = 'block';
            toggleRequired(bankFields, false);
            toggleRequired(idFields, true);
        }
    }

    function showTransactionForm(targetId) {
        document.querySelectorAll('.transaction-form').forEach(container => {
            container.style.display = 'none';
        });

        document.querySelectorAll('.category-card').forEach(card => {
            card.classList.remove('selected');
        });

        const targetElement = document.getElementById(targetId);
        if (targetElement) {
            targetElement.style.display = 'block';
        }

        const clickedCard = document.querySelector(`.category-card[data-target="${targetId}"]`);
        if (clickedCard) {
            clickedCard.classList.add('selected');
        }
        
        if (targetId === 'transfer-form') {
            const activeType = document.querySelector('#recipient-type-selector button.active')?.getAttribute('data-recipient-type') || 'bank';
            updateTransferFields(activeType);
        }
    }

    async function handleTransfer(event) {
        event.preventDefault();
        showToastMessage('transferMessageArea', 'Processing transfer...', 'info');
        showToastMessage('transferMessageArea', 'Transfer reviewed and ready to send (API logic placeholder)', 'success');
    }

    async function handleDeposit(event) {
        event.preventDefault();
        showToastMessage('depositMessageArea', 'Processing deposit...', 'info');
        showToastMessage('depositMessageArea', 'Deposit request confirmed (API logic placeholder)', 'success');
    }

    async function handleWithdraw(event) {
        event.preventDefault();
        showToastMessage('withdrawMessageArea', 'Processing withdrawal...', 'info');
        showToastMessage('withdrawMessageArea', 'Withdrawal request submitted (API logic placeholder)', 'success');
    }


    async function fetchAndPopulateProfile() {
        try {
            const data = await makeApiCall('/profile', 'GET'); 
            const form = document.querySelector('#profile .profile-form');
            if (form) {
                // Corrected property access for dynamic population
                form.querySelector('input[name="firstName"]').value = data.user.firstName || '';
                form.querySelector('input[name="lastName"]').value = data.user.lastName || '';
                form.querySelector('input[type="email"]').value = data.user.email || '';
                form.querySelector('input[type="tel"]').value = data.user.contactNumber || '';
            }
        } catch (error) {
            console.error('Error fetching profile data:', error);
            showToastMessage('profileMessageArea', 'Failed to load profile data.', 'error');
        }
    }

    async function handleProfileUpdate(event) {
        event.preventDefault();
        showToastMessage('profileMessageArea', 'Updating profile...', 'info');
        showToastMessage('profileMessageArea', 'Profile updated successfully!', 'success');
    }

    async function handleChangePassword(event) {
        event.preventDefault();
        showToastMessage('securityMessageArea', 'Changing password...', 'info');
        showToastMessage('securityMessageArea', 'Password changed successfully!', 'success');
    }


    async function handleSubmitTicket(event) {
        event.preventDefault();
        showToastMessage('ticketMessageArea', 'Submitting ticket...', 'info');
        showToastMessage('ticketMessageArea', 'Ticket submitted successfully! We will contact you soon.', 'success');
    }


    async function handleLogin(event) {
        event.preventDefault();
        showToastMessage('loginMessageArea', 'Logging in...', 'info');
        const fakeToken = 'sample_jwt_token_for_vaultbank';
        localStorage.setItem(TOKEN_KEY, fakeToken);
        window.location.href = 'dashboard.html';
    }

    async function handleSignup(event) {
        event.preventDefault();
        showToastMessage('signupMessageArea', 'Creating account...', 'info');
        showToastMessage('signupMessageArea', 'Account created! Redirecting to login...', 'success');
        setTimeout(() => {
             window.location.href = 'login.html';
        }, 1500);
    }


    document.addEventListener('DOMContentLoaded', () => {
        checkAuthentication(true); 

        const currentPage = window.location.pathname.split('/').pop();

        const logoutLink = document.getElementById('logoutLink');
        if (logoutLink) {
            logoutLink.addEventListener('click', handleLogout);
        }
        
        // --- PAGE-SPECIFIC INITIALIZATION ---

        if (currentPage === 'login.html') {
            const loginForm = document.getElementById('loginForm');
            if (loginForm) {
                loginForm.addEventListener('submit', handleLogin);
            }
        }
        
        if (currentPage === 'signup.html') {
            const signupForm = document.getElementById('signupForm');
            if (signupForm) {
                signupForm.addEventListener('submit', handleSignup);
            }
        }

        if (currentPage === 'dashboard.html') {
            fetchDashboardData();
        }

        if (currentPage === 'transaction.html') {
            fetchTransactions();
        }

        if (currentPage === 'support.html') {
            const ticketForm = document.getElementById('supportTicketForm');
            if (ticketForm) {
                ticketForm.addEventListener('submit', handleSubmitTicket);
            }
        }

        if (currentPage === 'transac.html') {
            fetchAndPopulateTransactionAccounts();

            const depositForm = document.getElementById('depositForm');
            const withdrawForm = document.getElementById('withdrawForm');
            const transferForm = document.getElementById('transferForm');

            if (depositForm) {
                depositForm.addEventListener('submit', handleDeposit);
            }
            if (withdrawForm) {
                withdrawForm.addEventListener('submit', handleWithdraw);
            }
            if (transferForm) {
                transferForm.addEventListener('submit', handleTransfer);
            }

            document.querySelectorAll('.category-grid .category-card').forEach(card => {
                card.addEventListener('click', () => {
                    const targetId = card.getAttribute('data-target');
                    showTransactionForm(targetId);
                });
            });

            document.querySelectorAll('#recipient-type-selector button').forEach(button => {
                button.addEventListener('click', () => {
                    const type = button.getAttribute('data-recipient-type');

                    document.querySelectorAll('#recipient-type-selector button').forEach(b => b.classList.remove('active'));
                    button.classList.add('active');
                    
                    updateTransferFields(type);
                });
            });

            const activeCard = document.querySelector('.category-card.selected');
            if (activeCard) {
                showTransactionForm(activeCard.getAttribute('data-target'));
            } else {
                showTransactionForm('transfer-form'); 
            }
        }
        
        if (currentPage === 'settings.html') {
            fetchAndPopulateProfile(); 
            
            const profileForm = document.querySelector('#profile .profile-form');
            if (profileForm) {
                profileForm.addEventListener('submit', handleProfileUpdate);
            }

            const securityForm = document.querySelector('#security .security-form');
            if (securityForm) {
                securityForm.addEventListener('submit', handleChangePassword);
            }
            
            document.querySelectorAll('.tab-item').forEach(tab => {
                tab.addEventListener('click', () => {
                    const target = tab.getAttribute('data-tab');
                    if (target === 'profile') {
                        fetchAndPopulateProfile();
                    }
                });
            });
        }
    });