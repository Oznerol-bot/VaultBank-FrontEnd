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

async function handleLogin(event) {
    event.preventDefault();
    const identifier = document.getElementById('identifier').value;
    const password = document.getElementById('password').value;
    
    showToastMessage('loginMessageArea', 'Logging in...', 'info');

    try {
        const data = await makeApiCall('/api/v1/auth/login', 'POST', { identifier, password });
        localStorage.setItem(TOKEN_KEY, data.token);
        window.location.href = 'dashboard.html';
    } catch (error) {
        showToastMessage('loginMessageArea', error.message || 'Login failed. Please check your credentials.', 'error');
    }
}

async function handleSignup(event) {
    event.preventDefault();
    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value;
    const email = document.getElementById('email').value;
    const contactNumber = document.getElementById('contactNumber').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password !== confirmPassword) {
        showToastMessage('signupMessageArea', 'Passwords do not match.', 'error');
        return;
    }

    showToastMessage('signupMessageArea', 'Registering...', 'info');

    try {
        const data = await makeApiCall('/api/v1/auth/register', 'POST', { 
            firstName, lastName, email, contactNumber, username, password 
        });
        showToastMessage('signupMessageArea', data.message, 'success');
    } catch (error) {
        showToastMessage('signupMessageArea', error.message || 'Registration failed.', 'error');
    }
}

function handleLogout() {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = 'login.html';
}

async function fetchDashboardData() {
    try {
        const data = await makeApiCall('/api/v1/dashboard/summary', 'GET');
        
        document.getElementById('welcomeMessage').textContent = `Welcome back, ${data.user.firstName}!`;
        document.getElementById('totalBalance').textContent = formatCurrency(data.user.totalBalance);
        document.getElementById('currentBalance').textContent = formatCurrency(data.user.currentBalance);
        document.getElementById('savingsBalance').textContent = formatCurrency(data.user.savingsBalance);
        document.getElementById('investmentBalance').textContent = formatCurrency(data.user.investmentBalance);
        document.getElementById('accountStatus').textContent = data.user.status;

        const transactionsList = document.getElementById('recentTransactions');
        if (transactionsList) {
            transactionsList.innerHTML = data.recentTransactions.map(tx => `
                <li class="${tx.type}">
                    ${tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}: ${formatCurrency(tx.amount)} on ${new Date(tx.createdAt).toLocaleDateString()}
                </li>
            `).join('');
        }

    } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        showToastMessage('dashboardMessageArea', error.message || 'Failed to load dashboard data.', 'error');
    }
}

async function handleProfileUpdate(event) {
    event.preventDefault();
    const firstName = document.getElementById('profileFirstName').value;
    const lastName = document.getElementById('profileLastName').value;
    const email = document.getElementById('profileEmail').value;
    const contactNumber = document.getElementById('profileContactNumber').value;

    showToastMessage('profileMessageArea', 'Updating profile...', 'info');

    try {
        const data = await makeApiCall('/api/v1/auth/profile', 'PUT', {
            firstName, lastName, email, contactNumber
        });
        showToastMessage('profileMessageArea', data.message || 'Profile updated successfully!', 'success');
        fetchAndPopulateProfile(); 
    } catch (error) {
        showToastMessage('profileMessageArea', error.message || 'Failed to update profile.', 'error');
    }
}

async function fetchAndPopulateProfile() {
    try {
        const user = await makeApiCall('/api/v1/auth/me', 'GET');
        document.getElementById('profileFirstName').value = user.firstName;
        document.getElementById('profileLastName').value = user.lastName;
        document.getElementById('profileEmail').value = user.email;
        document.getElementById('profileContactNumber').value = user.contactNumber;
        document.getElementById('profileUsername').textContent = user.username;
    } catch (error) {
        console.error('Failed to fetch profile data:', error);
        showToastMessage('profileMessageArea', 'Failed to load profile data.', 'error');
    }
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

async function handleTransfer(event) {
    event.preventDefault();
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

function showTransactionForm(formId) {
    document.querySelectorAll('.transaction-form').forEach(form => {
        form.style.display = 'none';
    });
    const formToShow = document.getElementById(formId);
    if (formToShow) {
        formToShow.style.display = 'block';
    }
}

async function fetchAndPopulateTransactionAccounts() {
    try {
        const user = await makeApiCall('/api/v1/auth/me', 'GET');
        const accounts = [
            { type: 'current', balance: user.currentBalance },
            { type: 'savings', balance: user.savingsBalance },
            { type: 'investment', balance: user.investmentBalance }
        ];

        const accountSelectors = [
            document.getElementById('d-account'),
            document.getElementById('w-account'),
            document.getElementById('sourceAccount')
        ];

        accountSelectors.forEach(selector => {
            if (selector) {
                selector.innerHTML = accounts.map(acc => 
                    `<option value="${acc.type}">${acc.type.charAt(0).toUpperCase() + acc.type.slice(1)} (${formatCurrency(acc.balance)})</option>`
                ).join('');
            }
        });

    } catch (error) {
        console.error('Failed to fetch accounts for transaction:', error);
    }
}

function updateTransferFields(activeType) {
    const bankFields = document.getElementById('recipient-bank-fields');
    const idFields = document.getElementById('recipient-id-fields');
    const requiredInputs = (activeType === 'bank' ? bankFields : idFields).querySelectorAll('input');
    const otherInputs = (activeType === 'bank' ? idFields : bankFields).querySelectorAll('input');

    if (activeType === 'bank') {
        bankFields.style.display = 'block';
        idFields.style.display = 'none';
    } else {
        bankFields.style.display = 'none';
        idFields.style.display = 'block';
    }

    requiredInputs.forEach(input => input.setAttribute('required', ''));
    otherInputs.forEach(input => input.removeAttribute('required'));
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuthentication();

    const currentPage = window.location.pathname.split('/').pop();

    if (currentPage === 'login.html') {
        const form = document.querySelector('.login-form');
        if (form) {
            form.addEventListener('submit', handleLogin);
        }
    }

    if (currentPage === 'signup.html') {
        const form = document.querySelector('.signup-form');
        if (form) {
            form.addEventListener('submit', handleSignup);
        }
    }

    if (currentPage === 'dashboard.html') {
        fetchDashboardData();
        const logoutButton = document.getElementById('logoutButton');
        if (logoutButton) {
            logoutButton.addEventListener('click', handleLogout);
        }
    }

    if (currentPage === 'transac.html') {
        fetchAndPopulateTransactionAccounts();

        document.querySelectorAll('.category-card').forEach(card => {
            card.addEventListener('click', function() {
                document.querySelectorAll('.category-card').forEach(c => c.classList.remove('selected'));
                this.classList.add('selected');
                showTransactionForm(this.getAttribute('data-target'));
            });
        });

        document.querySelectorAll('#recipient-type-selector button').forEach(button => {
            button.addEventListener('click', function() {
                const type = this.getAttribute('data-type');
                
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