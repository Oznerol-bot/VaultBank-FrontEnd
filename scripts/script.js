const API_BASE_URL = 'https://vaultbank-7i3m.onrender.com';
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
            const clone = response.clone();
            
            let responseData;
            try {
                responseData = await response.json();
            } catch (e) {
                if (response.ok) {
                    return {};
                }
                
                const errorText = await clone.text();
                console.error("Non-JSON error response received:", errorText.substring(0, 100) + '...');
                
                if (response.status === 401) {
                    localStorage.removeItem(TOKEN_KEY);
                    if (window.location.pathname.split('/').pop() !== 'login.html') {
                        window.location.href = 'login.html';
                    }
                }

                throw new Error(`Server returned a non-JSON response. Status: ${response.status}.`);
            }

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem(TOKEN_KEY);
                    if (window.location.pathname.split('/').pop() !== 'login.html') {
                        window.location.href = 'login.html';
                    }
                }
                throw new Error(responseData.message || `API request failed with status ${response.status}`);
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
        const isIncome = transaction.type === 'deposit' || transaction.type === 'transfer'; 
        const iconClass = isIncome ? 'fa-arrow-down' : 'fa-arrow-up'; 
        const color = isIncome ? 'var(--success)' : 'var(--danger)';
        const amountSign = isIncome ? '+' : '-';
        const amountClass = isIncome ? 'positive' : 'negative';
        const formattedAmount = formatCurrency(transaction.amount);
        const date = new Date(transaction.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

        let description = transaction.description || `${transaction.type} transaction`;
        if (transaction.type === 'transfer') {
            description = `Transfer`; 
        } else if (transaction.type === 'withdraw') {
            description = `Withdrawal`;
        } else if (transaction.type === 'deposit') {
            description = `Deposit`;
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
            const data = await makeApiCall('/api/v1/dashboard/summary', 'GET');

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
            const data = await makeApiCall('/api/v1/reports/transactions-summary', 'GET'); 
            const listElement = document.getElementById('transactions-list');
            const summaryIncome = document.querySelector('.summary-card.income .amount');
            const summaryExpense = document.querySelector('.summary-card.expense .amount');
            const summaryNet = document.querySelector('.summary-card.net .amount');
            
            const transactions = data.transactions || [];
            const summary = data.summary || { totalIncome: 0, totalExpenses: 0, netBalance: 0 };


            if (transactions.length === 0) {
                 listElement.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px;">No transactions found.</td></tr>`;
                 summaryIncome.textContent = formatCurrency(0);
                 summaryExpense.textContent = formatCurrency(0);
                 summaryNet.textContent = formatCurrency(0);
                 return;
            }

            const tableRows = transactions.map(t => {
                const isIncome = t.isIncome;
                const amountDisplay = isIncome ? formatCurrency(t.amount) : formatCurrency(-t.amount);
                
                const statusClass = 'status-completed'; 
                const statusText = 'COMPLETED';
                const transactionId = t.transactionId.slice(-6); 
                
                return `
                    <tr>
                        <td>${t.date}</td>
                        <td>${transactionId}</td> 
                        <td>${t.type}</td>
                        <td><span class="${statusClass}">${statusText}</span></td>
                        <td class="${isIncome ? 'positive' : 'negative'}">${amountDisplay}</td>
                    </tr>
                `;
            }).join('');

            listElement.innerHTML = tableRows;
            summaryIncome.textContent = '+' + formatCurrency(summary.totalIncome);
            summaryExpense.textContent = '-' + formatCurrency(summary.totalExpenses);
            summaryNet.textContent = formatCurrency(summary.netBalance);
            
        } catch (error) {
            console.error('Error fetching transactions:', error);
            document.getElementById('transactions-list').innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px; color: var(--danger);">Failed to load transactions.</td></tr>`;
        }
    }


    async function fetchAndPopulateTransactionAccounts() {
        try {
            const data = await makeApiCall('/api/v1/dashboard/summary', 'GET');

            if (!data || !data.user) throw new Error("Invalid dashboard data received.");

            const accounts = [
                { name: "Current Balance", id: "CHK", balance: data.user.currentBalance },
                { name: "Savings Account", id: "SAV", balance: data.user.savingsBalance },
                { name: "Investment Account", id: "INV", balance: data.user.investmentBalance },
            ];

            const dropdowns = [
                { elementId: 'w-account', includeBalance: true, includeInvestment: true, label: "Withdraw From" },
                { elementId: 'd-account', includeBalance: false, includeInvestment: true, label: "Deposit To" },
                { elementId: 'sourceAccount', includeBalance: true, includeInvestment: false, label: "Send From" }
            ];

            dropdowns.forEach(({ elementId, includeBalance, includeInvestment, label }) => {
                const element = document.getElementById(elementId);
                if (!element) return;

                element.innerHTML = '';
                
                const defaultOption = document.createElement('option');
                defaultOption.textContent = `-- Select ${label} --`;
                defaultOption.value = "";
                defaultOption.disabled = true;
                defaultOption.selected = true;
                element.appendChild(defaultOption);

                accounts.forEach(account => {
                    if (!includeInvestment && account.name === "Investment Account") {
                        return;
                    }

                    const option = document.createElement('option');
                    let textContent = account.name;
                    
                    if (includeBalance) {
                        textContent += ` (${formatCurrency(account.balance)})`;
                    }
                    
                    option.textContent = textContent;
                    option.value = account.id; 
                    element.appendChild(option);
                });
            });

        } catch (error) {
            console.error('Error fetching account data for transactions:', error);
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
    // Assuming the amount input is 'transferAmount' and the recipient email input is 'recipientId'
    const amount = parseFloat(document.getElementById('transferAmount').value);
    const toEmail = document.getElementById('recipientId')?.value; 
    
    if (isNaN(amount) || amount <= 0) {
        showToastMessage('transferMessageArea', 'Please enter a valid positive amount.', 'error');
        return;
    }
    if (!toEmail) {
        showToastMessage('transferMessageArea', 'Please enter a valid recipient ID (Email).', 'error');
        return;
    }

    showToastMessage('transferMessageArea', 'Processing transfer...', 'info');

    try {
        const data = await makeApiCall('/api/v1/transactions/transfer', 'POST', { 
            toEmail, 
            amount 
        });

        showToastMessage('transferMessageArea', data.message || 'Transfer successful!', 'success');
        
        document.getElementById('transferAmount').value = '';
        document.getElementById('recipientId').value = '';
        
        if (typeof fetchDashboardData === 'function') fetchDashboardData(); 

    } catch (error) {
        console.error('Transfer error:', error);
        showToastMessage('transferMessageArea', error.message || 'Transfer failed.', 'error');
    }
}
    async function handleDeposit(event) {
    event.preventDefault();
    const amountInput = document.getElementById('depositAmount'); 
    const amount = parseFloat(amountInput.value);
    
    if (isNaN(amount) || amount <= 0) {
        showToastMessage('depositMessageArea', 'Please enter a valid positive amount.', 'error');
        return;
    }
    
    showToastMessage('depositMessageArea', 'Processing deposit...', 'info');

    try {
        const data = await makeApiCall('/api/v1/transactions/deposit', 'POST', { amount });

        showToastMessage('depositMessageArea', data.message || 'Deposit successful!', 'success');
        amountInput.value = ''; 
    
        if (typeof fetchDashboardData === 'function') fetchDashboardData(); 
    } catch (error) {
        console.error('Deposit error:', error);
        showToastMessage('depositMessageArea', error.message || 'Deposit failed.', 'error');
    }
}
    async function handleWithdraw(event) {
    event.preventDefault();
    const amountInput = document.getElementById('withdrawAmount');
    const amount = parseFloat(amountInput.value);
    if (isNaN(amount) || amount <= 0) {
        showToastMessage('withdrawMessageArea', 'Please enter a valid positive amount.', 'error');
        return;
    }
    
    showToastMessage('withdrawMessageArea', 'Processing withdrawal...', 'info');
    try {
        const data = await makeApiCall('/api/v1/transactions/withdraw', 'POST', { amount });

        showToastMessage('withdrawMessageArea', data.message || 'Withdrawal successful!', 'success');
        amountInput.value = ''; 
    
        if (typeof fetchDashboardData === 'function') fetchDashboardData(); 
    } catch (error) {
        console.error('Withdrawal error:', error);
        showToastMessage('withdrawMessageArea', error.message || 'Withdrawal failed.', 'error');
    }
}


    async function fetchAndPopulateProfile() {
        try {
            const data = await makeApiCall('/api/v1/auth/me', 'GET'); 
            const form = document.querySelector('#profile .profile-form');
            if (form) {
                form.querySelector('input[name="firstName"]').value = data.firstName || '';
                form.querySelector('input[name="lastName"]').value = data.lastName || '';
                form.querySelector('input[name="email"]').value = data.email || '';
                form.querySelector('input[name="contactNumber"]').value = data.contactNumber || '';
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
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewPassword').value;
    
    if (newPassword !== confirmNewPassword) {
        showToastMessage('securityMessageArea', 'New passwords do not match.', 'error');
        return;
    }

    if (newPassword.length < 6) {
        showToastMessage('securityMessageArea', 'New password must be at least 6 characters.', 'error');
        return;
    }

    showToastMessage('securityMessageArea', 'Changing password...', 'info');
    
    try {
        const data = await makeApiCall('/api/v1/auth/change-password', 'PATCH', { 
            currentPassword,
            newPassword
        });

    

        showToastMessage('securityMessageArea', data.message || 'Password changed successfully!', 'success');
        
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmNewPassword').value = '';

    } catch (error) {
        console.error('Password change error:', error);
        showToastMessage('securityMessageArea', error.message || 'Failed to change password. Please check your current password.', 'error');
    }
}

    async function handleSubmitTicket(event) {
        event.preventDefault();
        showToastMessage('ticketMessageArea', 'Submitting ticket...', 'info');
        showToastMessage('ticketMessageArea', 'Ticket submitted successfully! We will contact you soon.', 'success');
    }


 async function handleLogin(event) {
    event.preventDefault();

    const identifier = document.getElementById('identifier').value;
    const password = document.getElementById('password').value;
    
    showToastMessage('loginMessageArea', 'Logging in...', 'info');

    try {
        const data = await makeApiCall('/api/v1/auth/login', 'POST', { identifier, password }, false);

        localStorage.setItem(TOKEN_KEY, data.token);
        
        showToastMessage('loginMessageArea', data.message || 'Login successful!', 'success');
        
        window.location.href = 'dashboard.html';

    } catch (error) {
        console.error('Login error:', error);
        showToastMessage('loginMessageArea', error.message || 'Login failed. Please try again.', 'error');
    }
}

async function handleSignup(event) {
    event.preventDefault();

    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const email = document.getElementById('email').value.trim();
    const contactNumber = document.getElementById('contactNumber').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const username = document.getElementById('username').value.trim();

    if (password !== confirmPassword) {
        showToastMessage('signupMessageArea', 'Passwords do not match.', 'alert-danger');
        return;
    }

    if (password.length < 6) {
        showToastMessage('signupMessageArea', 'Password must be at least 6 characters.', 'alert-danger');
        return;
    }

    showToastMessage('signupMessageArea', 'Creating account...', 'alert-info');

    try {
        const data = await makeApiCall('/api/v1/auth/register', 'POST', {
            firstName,
            lastName,
            email: email.toLowerCase(),
            contactNumber,
            password,
            username: username.toLowerCase()
        });

        showToastMessage('signupMessageArea', data.message || 'Account created! Please wait for admin approval.', 'alert-success');

        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);

    } catch (error) {
        console.error('Signup error:', error);
        showToastMessage('signupMessageArea', error.message || 'Registration failed. Please try again.', 'alert-danger');
    }
}

    document.addEventListener('DOMContentLoaded', () => {
        checkAuthentication(true); 

        const currentPage = window.location.pathname.split('/').pop();

        const logoutLink = document.getElementById('logoutLink');
        if (logoutLink) {
            logoutLink.addEventListener('click', handleLogout);
        }
        

        if (currentPage === 'login.html') {
            const loginForm = document.getElementById('loginForm');
            if (loginForm) {
                loginForm.addEventListener('submit', handleLogin);
            }
            checkAuthentication(true);
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