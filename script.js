/**
 * MITR — Smart Bill Splitter
 * Vercel deployment version — API key is server-side only
 */


const state = {
    tripName: '',
    memberCount: 0,
    members: [],
    expenses: [],
};


const $ = id => document.getElementById(id);

const els = {
    placeInput:     $('place'),
    setTrip:        $('set-trip'),
    countInput:     $('count'),
    setCount:       $('set-count'),
    nameInput:      $('name'),
    addMem:         $('Add-mem'),
    listMember:     $('list-member'),
    membersCounter: $('members-counter'),
    expenseInput:   $('expense'),
    addExp:         $('Add-exp'),
    submitBtn:      $('submit'),

    billTripRow:         $('bill-trip-row'),
    billTripName:        $('bill-trip-name'),
    billMembersSection:  $('bill-members-section'),
    membersChips:        $('members-chips'),
    billExpensesSection: $('bill-expenses-section'),
    expenseLog:          $('expense-log'),
    billEmpty:           $('bill-empty'),

    overlay:          $('overlay'),
    popupLoading:     $('popup-loading'),
    popupResults:     $('popup-results'),
    popupError:       $('popup-error'),
    popupTripName:    $('popup-trip-name'),
    errorMsg:         $('error-msg'),
    closePopup:       $('close-popup'),
    retryBtn:         $('retry-btn'),
    expenseTableBody: $('expense-table-body'),
    settleTableBody:  $('settle-table-body'),
    transactionsList: $('transactions-list'),
};


(function init() {
    els.setTrip.addEventListener('click', handleSetTrip);
    els.placeInput.addEventListener('keydown', e => { if(e.key==='Enter') handleSetTrip(); });

    els.setCount.addEventListener('click', handleSetCount);
    els.countInput.addEventListener('keydown', e => { if(e.key==='Enter') handleSetCount(); });

    els.addMem.addEventListener('click', handleAddMember);
    els.nameInput.addEventListener('keydown', e => { if(e.key==='Enter') handleAddMember(); });

    els.addExp.addEventListener('click', handleAddExpense);
    els.expenseInput.addEventListener('keydown', e => {
        if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleAddExpense(); }
    });

    els.submitBtn.addEventListener('click', handleSubmit);
    els.closePopup.addEventListener('click', closePopup);
    els.retryBtn.addEventListener('click', handleSubmit);
    els.overlay.addEventListener('click', e => { if(e.target===els.overlay) closePopup(); });
})();


function handleSetTrip() {
    const name = els.placeInput.value.trim();
    if (!name) { showToast('Please enter a trip name', 'error'); return; }
    state.tripName = name;
    els.billTripName.textContent = name;
    els.billTripRow.style.display = 'flex';
    checkHideEmpty();
    showToast(`Trip set: ${name}`, 'success');
    els.countInput.focus();
}


function handleSetCount() {
    const n = parseInt(els.countInput.value);
    if (!n || n < 2 || n > 20) { showToast('Enter a valid count (2–20)', 'error'); return; }
    state.memberCount = n;
    state.members = [];
    updateMembersCounter();
    showToast(`${n} members set. Now add their names.`, 'success');
    els.nameInput.focus();
}


function handleAddMember() {
    if (!state.memberCount) { showToast('Set member count first', 'error'); return; }
    const name = capitalise(els.nameInput.value.trim());
    if (!name) { showToast('Enter a member name', 'error'); return; }
    if (state.members.includes(name)) { showToast(`${name} is already added`, 'error'); return; }
    if (state.members.length >= state.memberCount) {
        showToast(`Already added all ${state.memberCount} members`, 'error'); return;
    }
    state.members.push(name);
    els.nameInput.value = '';
    els.nameInput.focus();
    updateMembersCounter();
    renderMembersList();
    renderMemberChips();
    checkHideEmpty();
    if (state.members.length === state.memberCount) {
        showToast(`All ${state.memberCount} members added! Now add expenses.`, 'success');
    }
}

function updateMembersCounter() {
    els.membersCounter.textContent = `${state.members.length} / ${state.memberCount || '?'}`;
}
function renderMembersList() {
    els.listMember.textContent = state.members.length ? `✓ ${state.members.join(', ')}` : '';
}
function renderMemberChips() {
    els.membersChips.innerHTML = state.members.map(m => `
        <div class="chip">
            <div class="chip-avatar">${m[0].toUpperCase()}</div>${m}
        </div>`).join('');
    els.billMembersSection.style.display = state.members.length ? 'block' : 'none';
}


function handleAddExpense() {
    if (!state.members.length) { showToast('Add members first', 'error'); return; }
    const text = els.expenseInput.value.trim();
    if (!text) { showToast('Enter an expense description', 'error'); return; }
    state.expenses.push({ raw: text });
    els.expenseInput.value = '';
    els.expenseInput.focus();
    renderExpenseLog();
    checkHideEmpty();
    showToast('Expense added', 'success');
}

function renderExpenseLog() {
    if (!state.expenses.length) { els.billExpensesSection.style.display = 'none'; return; }
    els.billExpensesSection.style.display = 'block';
    els.expenseLog.innerHTML = state.expenses.map((e, i) => `
        <div class="exp-item" id="exp-item-${i}">
            <span class="exp-item-num">#${i+1}</span>
            <span class="exp-item-text">${escHtml(e.raw)}</span>
            <span class="exp-item-del" onclick="deleteExpense(${i})">✕</span>
        </div>`).join('');
    els.expenseLog.scrollTop = els.expenseLog.scrollHeight;
}

function deleteExpense(i) {
    state.expenses.splice(i, 1);
    renderExpenseLog();
    checkHideEmpty();
}

function checkHideEmpty() {
    const hasData = state.tripName || state.members.length || state.expenses.length;
    els.billEmpty.style.display = hasData ? 'none' : 'flex';
}


async function handleSubmit() {
    if (!state.tripName)        { showToast('Set a trip name first', 'error'); return; }
    if (!state.members.length)  { showToast('Add at least one member', 'error'); return; }
    if (!state.expenses.length) { showToast('Add at least one expense', 'error'); return; }

    openPopup();

    try {
        const parsedExpenses = await parseAllExpenses();
        const { balances, transactions, expenseDetails } = calculateSplit(parsedExpenses);
        renderResults(expenseDetails, balances, transactions);
    } catch (err) {
        showError(err.message || 'Something went wrong. Please try again.');
    }
}


async function parseAllExpenses() {
    const memberList  = state.members.join(', ');
    const expenseList = state.expenses.map((e, i) => `${i+1}. "${e.raw}"`).join('\n');

    const prompt = `
You are a smart expense parser for a group trip bill splitter app.

Members in the group: ${memberList}

Parse each expense below and return a JSON array. For each expense, extract:
- "description": short label for the expense (3-5 words)
- "paidBy": name of who paid (must match a member name exactly)
- "amount": numeric amount in INR (extract from text, or 0 if missing)
- "excludes": array of member names NOT included in split (e.g. "excluding Raman" → ["Raman"]). Empty array if none.
- "splitAmong": array of member names who share this cost (everyone except excludes)

Rules:
- Member name matching is case-insensitive. Always return names exactly as given.
- If "excluding X" or "not including X" appears, add X to excludes.
- If "only for X and Y" appears, splitAmong = [X, Y].
- If amount is missing, return 0.

Member list: [${state.members.map(m=>`"${m}"`).join(', ')}]

Expenses:
${expenseList}

Return ONLY a valid JSON array, no markdown, no explanation, no backticks.
`;

    
    const res = await fetch('/api/parse-expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error (${res.status})`);
    }

    const { text } = await res.json();
    const cleaned = text.replace(/```json|```/g, '').trim();

    let parsed;
    try {
        parsed = JSON.parse(cleaned);
    } catch {
        const match = cleaned.match(/\[[\s\S]*\]/);
        if (match) {
            try { parsed = JSON.parse(match[0]); }
            catch { throw new Error('Could not parse AI response. Please rephrase your expenses.'); }
        } else {
            throw new Error('Unexpected AI response. Please try again.');
        }
    }

    if (!Array.isArray(parsed)) throw new Error('Unexpected response format.');
    return parsed;
}


function calculateSplit(parsedExpenses) {
    const paid = {}, owed = {};
    state.members.forEach(m => { paid[m] = 0; owed[m] = 0; });

    const expenseDetails = parsedExpenses.map((exp, i) => {
        const rawText = state.expenses[i]?.raw || exp.description;
        const paidBy  = findMember(exp.paidBy) || state.members[0];
        const amount  = parseFloat(exp.amount) || 0;

        let splitAmong = (exp.splitAmong || []).map(n => findMember(n)).filter(Boolean);
        if (!splitAmong.length) {
            const excl = (exp.excludes || []).map(n => findMember(n)).filter(Boolean);
            splitAmong = state.members.filter(m => !excl.includes(m));
        }
        if (!splitAmong.length) splitAmong = [...state.members];

        const perHead = splitAmong.length ? amount / splitAmong.length : 0;
        paid[paidBy] = (paid[paidBy] || 0) + amount;
        splitAmong.forEach(m => { owed[m] = (owed[m] || 0) + perHead; });

        return {
            raw: rawText,
            description: exp.description || rawText,
            paidBy, amount, splitAmong,
            excludes: (exp.excludes || []).map(n => findMember(n)).filter(Boolean),
            perHead
        };
    });

    const balances = state.members.map(m => ({
        name: m,
        totalPaid: paid[m] || 0,
        totalOwed: owed[m] || 0,
        net: (paid[m] || 0) - (owed[m] || 0)
    }));

    return { balances, transactions: settleUp(balances), expenseDetails };
}

function settleUp(balances) {
    const creditors = balances.filter(b => b.net >  0.005).map(b => ({ ...b }));
    const debtors   = balances.filter(b => b.net < -0.005).map(b => ({ ...b }));
    const transactions = [];
    creditors.sort((a,b) => b.net - a.net);
    debtors.sort((a,b) => a.net - b.net);
    let ci = 0, di = 0;
    while (ci < creditors.length && di < debtors.length) {
        const amount = Math.min(creditors[ci].net, -debtors[di].net);
        if (amount > 0.005) transactions.push({ from: debtors[di].name, to: creditors[ci].name, amount: Math.round(amount * 100) / 100 });
        creditors[ci].net -= amount;
        debtors[di].net   += amount;
        if (Math.abs(creditors[ci].net) < 0.005) ci++;
        if (Math.abs(debtors[di].net)   < 0.005) di++;
    }
    return transactions;
}


function renderResults(expenseDetails, balances, transactions) {
    els.expenseTableBody.innerHTML = expenseDetails.map(e => `
        <tr>
            <td>${escHtml(e.description)}</td>
            <td><span class="chip" style="display:inline-flex">
                <span class="chip-avatar">${e.paidBy?.[0]||'?'}</span>${escHtml(e.paidBy||'Unknown')}
            </span></td>
            <td><strong>₹${fmt(e.amount)}</strong></td>
            <td style="font-size:12px;color:var(--muted)">${e.splitAmong.join(', ')}</td>
            <td>₹${fmt(e.perHead)}</td>
        </tr>`).join('');

    els.settleTableBody.innerHTML = balances.map(b => {
        const netFmt  = fmt(Math.abs(b.net));
        const netClass = b.net > 0.5 ? 'balance-pos' : b.net < -0.5 ? 'balance-neg' : 'balance-zero';
        const netSign  = b.net > 0.5 ? `+₹${netFmt}` : b.net < -0.5 ? `-₹${netFmt}` : '₹0';
        const actionLabel = b.net > 0.5 ? 'Gets back' : b.net < -0.5 ? 'Owes' : 'Settled';
        const actionClass = b.net > 0.5 ? 'gets' : b.net < -0.5 ? 'pays' : 'settle';
        return `<tr>
            <td><span class="chip" style="display:inline-flex">
                <span class="chip-avatar">${b.name[0]}</span>${escHtml(b.name)}
            </span></td>
            <td>₹${fmt(b.totalPaid)}</td>
            <td>₹${fmt(b.totalOwed)}</td>
            <td class="${netClass}">${netSign}</td>
            <td><span class="action-tag ${actionClass}">${actionLabel}</span></td>
        </tr>`;
    }).join('');

    if (!transactions.length) {
        els.transactionsList.innerHTML = `<div class="no-transaction">🎉 Everyone is settled up!</div>`;
    } else {
        els.transactionsList.innerHTML = transactions.map(t => `
            <div class="transaction-item">
                <span class="t-from">${escHtml(t.from)}</span>
                <span class="t-arrow">→ pays →</span>
                <span class="t-to">${escHtml(t.to)}</span>
                <span class="t-amount">₹${fmt(t.amount)}</span>
            </div>`).join('');
    }

    els.popupLoading.style.display = 'none';
    els.popupResults.style.display = 'flex';
    els.popupTripName.textContent = state.tripName;
}


function openPopup() {
    els.overlay.style.display = 'flex';
    els.popupLoading.style.display = 'flex';
    els.popupResults.style.display = 'none';
    els.popupError.style.display = 'none';
    els.popupTripName.textContent = state.tripName;
    document.body.style.overflow = 'hidden';
}
function closePopup() {
    els.overlay.style.display = 'none';
    document.body.style.overflow = '';
}
function showError(msg) {
    els.popupLoading.style.display = 'none';
    els.popupResults.style.display = 'none';
    els.popupError.style.display = 'flex';
    els.errorMsg.textContent = msg;
}


function capitalise(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function findMember(name) {
    if (!name) return null;
    const n = name.toLowerCase().trim();
    return state.members.find(m => m.toLowerCase() === n) ||
           state.members.find(m => m.toLowerCase().startsWith(n)) || null;
}
function fmt(n) {
    return parseFloat(n||0).toFixed(2).replace(/\.00$/,'').replace(/(\.\d)0$/,'$1');
}
function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
let toastTimer;
function showToast(msg, type='') {
    let toast = document.querySelector('.toast');
    if (!toast) { toast = document.createElement('div'); toast.className='toast'; document.body.appendChild(toast); }
    clearTimeout(toastTimer);
    toast.textContent = msg;
    toast.className = `toast ${type}`;
    void toast.offsetWidth;
    toast.classList.add('show');
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}