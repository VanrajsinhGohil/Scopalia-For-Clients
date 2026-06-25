// admin.js

let currentUserId = null;
let charts = {};
let editStates = {
    client: null,
    project: null,
    video: null,
    petrol: null,
    payment: null
};

document.addEventListener('DOMContentLoaded', async () => {
    // Check Auth
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'index.html';
        return;
    }
    
    currentUserId = session.user.id;
    
    // Verify Admin Role
    const { data: profile } = await supabaseClient.from('profiles').select('role').eq('id', currentUserId).single();
    if (!profile || profile.role !== 'admin') {
        window.location.href = 'client.html';
        return;
    }

    // Auth verification succeeded, show body
    document.body.style.display = 'block';

    // Navigation
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebarClose = document.getElementById('sidebarClose');

    const navLinks = document.querySelectorAll('.nav-link');
    const viewSections = document.querySelectorAll('.view-section');
    const pageTitle = document.getElementById('pageTitle');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const viewId = link.getAttribute('data-view');
            
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            viewSections.forEach(v => v.classList.remove('active'));
            document.getElementById(`view-${viewId}`).classList.add('active');
            
            pageTitle.textContent = link.textContent.trim();
            
            // Close mobile sidebar on transition
            if (sidebar && window.innerWidth < 1024) {
                sidebar.classList.add('-translate-x-full');
                sidebarOverlay.classList.add('hidden');
            }

            // Load data based on view
            loadViewData(viewId);
        });
    });

    // Mobile Sidebar Toggle Listeners
    if (sidebarToggle && sidebar && sidebarOverlay) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.remove('-translate-x-full');
            sidebarOverlay.classList.remove('hidden');
        });
    }

    const closeSidebar = () => {
        sidebar.classList.add('-translate-x-full');
        sidebarOverlay.classList.add('hidden');
    };

    if (sidebarClose) {
        sidebarClose.addEventListener('click', closeSidebar);
    }
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeSidebar);
    }

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.href = 'index.html';
    });

    // Modals
    window.openModal = async (id) => {
        document.getElementById('modalOverlay').classList.remove('hidden');
        document.getElementById(id).classList.remove('hidden');

        // Populate dropdowns dynamically on opening modal
        if (id === 'projectModal') {
            await populateClientsDropdown('pClientSelect');
        } else if (id === 'videoModal') {
            await populateProjectsDropdown('vProjectSelect');
        } else if (id === 'petrolModal') {
            await populateClientsDropdown('peClientSelect');
        } else if (id === 'paymentModal') {
            await populateClientsDropdown('payClientSelect');
            await populateProjectsDropdown('payProjectSelect');
        }
    }

    window.closeModals = () => {
        document.getElementById('modalOverlay').classList.add('hidden');
        document.querySelectorAll('#modalOverlay > div').forEach(d => d.classList.add('hidden'));

        // Reset edit states and UI elements
        editStates = { client: null, project: null, video: null, petrol: null, payment: null };
        
        document.getElementById('clientModalTitle').textContent = 'Add Client';
        document.getElementById('clientSubmitBtn').textContent = 'Create Client Account';
        document.getElementById('clientAuthFields').classList.remove('hidden');
        document.getElementById('cEmail').required = true;
        document.getElementById('cPassword').required = true;
        
        document.getElementById('projectModalTitle').textContent = 'Create Project';
        document.getElementById('videoModalTitle').textContent = 'Upload Video';
        const vFileEl = document.getElementById('vFile');
        vFileEl.required = true;
        vFileEl.setAttribute('multiple', 'multiple');
        document.getElementById('vFileLabel').textContent = 'Select Video File(s)';
        document.getElementById('petrolModalTitle').textContent = 'Log Petrol Expense';
        document.getElementById('paymentModalTitle').textContent = 'Record Payment';

        // Reset forms
        document.getElementById('formAddClient').reset();
        document.getElementById('formAddProject').reset();
        document.getElementById('formAddVideo').reset();
        document.getElementById('formAddPetrol').reset();
        document.getElementById('formAddPayment').reset();
    }

    // Initialize Dashboard Data
    loadViewData('dashboard');

    // Setup forms
    document.getElementById('formAddClient').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullName = document.getElementById('cName').value;
        const companyName = document.getElementById('cCompany').value;

        if (editStates.client) {
            // Edit client details
            const { error } = await supabaseClient.from('profiles')
                .update({ full_name: fullName, company_name: companyName })
                .eq('id', editStates.client);

            if (error) {
                alert('Error: ' + error.message);
            } else {
                alert('Client details updated successfully!');
                closeModals();
                loadViewData('clients');
            }
        } else {
            // Register new client using a temporary client to prevent session hijacking
            const email = document.getElementById('cEmail').value;
            const password = document.getElementById('cPassword').value;

            try {
                const tempClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                    auth: {
                        persistSession: false,
                        autoRefreshToken: false,
                        detectSessionInUrl: false
                    }
                });

                const { data, error } = await tempClient.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: fullName,
                            role: 'client'
                        }
                    }
                });

                if (error) throw error;

                if (data.user) {
                    // Update company name using admin's active session
                    const { error: profileError } = await supabaseClient.from('profiles')
                        .update({ company_name: companyName })
                        .eq('id', data.user.id);
                    if (profileError) console.error("Error updating profile company name:", profileError);
                }

                alert('Client created successfully!');
                closeModals();
                loadViewData('clients');
            } catch (err) {
                console.error("Signup error:", err);
                alert('Error: ' + (err.message || err));
            }
        }
    });

    document.getElementById('formAddProject').addEventListener('submit', async (e) => {
        e.preventDefault();
        const client_id = document.getElementById('pClientSelect').value;
        const name = document.getElementById('pName').value;
        const project_type = document.getElementById('pType').value;
        const description = document.getElementById('pDesc').value;
        const start_date = document.getElementById('pStart').value;
        const due_date = document.getElementById('pDue').value;
        const status = document.getElementById('pStatus').value;

        let res;
        if (editStates.project) {
            res = await supabaseClient.from('projects').update({
                client_id, name, project_type, description, start_date, due_date, status
            }).eq('id', editStates.project);
        } else {
            res = await supabaseClient.from('projects').insert({
                client_id, name, project_type, description, start_date, due_date, status
            });
        }

        if (res.error) {
            alert('Error: ' + res.error.message);
        } else {
            // Trigger client notification
            try {
                const notificationTitle = editStates.project ? "Project Details Updated" : "New Project Registered";
                const notificationMessage = editStates.project
                    ? `Your project "${name}" details have been updated. Status: ${status}.`
                    : `A new project "${name}" has been registered for you. Current status: ${status}.`;

                await supabaseClient.from('notifications').insert({
                    user_id: client_id,
                    title: notificationTitle,
                    message: notificationMessage
                });
            } catch (err) {
                console.error("Error creating project notification:", err);
            }

            alert(editStates.project ? 'Project updated successfully!' : 'Project created successfully!');
            closeModals();
            loadViewData('projects');
        }
    });

    document.getElementById('formAddVideo').addEventListener('submit', async (e) => {
        e.preventDefault();
        const project_id = document.getElementById('vProjectSelect').value;
        const title = document.getElementById('vTitle').value;
        const description = document.getElementById('vDesc').value;
        const fileEl = document.getElementById('vFile');
        const submitBtn = document.querySelector('#formAddVideo button[type="submit"]');

        const files = fileEl.files;

        try {
            submitBtn.disabled = true;

            if (editStates.video) {
                // Editing a single video
                const file = files[0];
                let file_url = null;
                let file_size = null;

                if (file) {
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${Math.random()}.${fileExt}`;
                    const { data: uploadData, error: uploadError } = await supabaseClient.storage
                        .from('videos')
                        .upload(fileName, file);

                    if (uploadError) {
                        alert('Upload error: ' + uploadError.message);
                        return;
                    }
                    file_url = uploadData.path;
                    file_size = file.size;
                }

                const updateFields = { project_id, title, description };
                if (file_url) {
                    updateFields.file_url = file_url;
                    updateFields.file_size = file_size;
                }
                const res = await supabaseClient.from('videos').update(updateFields).eq('id', editStates.video);
                if (res.error) throw res.error;

                // Send notification
                try {
                    const { data: projData } = await supabaseClient.from('projects').select('client_id, name').eq('id', project_id).single();
                    if (projData) {
                        await supabaseClient.from('notifications').insert({
                            user_id: projData.client_id,
                            title: "Deliverable Video Updated",
                            message: `A video deliverable "${title}" for project "${projData.name}" has been updated.`
                        });
                    }
                } catch (err) {
                    console.error("Error creating video notification:", err);
                }

                alert('Video updated successfully!');
            } else {
                // Creating one or more new videos
                if (!files || files.length === 0) {
                    alert('Please select at least one file to upload');
                    return;
                }

                const { data: projData } = await supabaseClient.from('projects').select('client_id, name').eq('id', project_id).single();

                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    submitBtn.textContent = `Uploading ${i + 1}/${files.length}...`;

                    const fileExt = file.name.split('.').pop();
                    const fileName = `${Math.random()}.${fileExt}`;
                    const { data: uploadData, error: uploadError } = await supabaseClient.storage
                        .from('videos')
                        .upload(fileName, file);

                    if (uploadError) throw uploadError;

                    const fileNameOnly = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                    const itemTitle = files.length > 1 ? `${title} - ${fileNameOnly}` : title;

                    const res = await supabaseClient.from('videos').insert({
                        project_id, title: itemTitle, description, file_url: uploadData.path, file_size: file.size
                    });
                    if (res.error) throw res.error;

                    // Send notification
                    if (projData) {
                        try {
                            await supabaseClient.from('notifications').insert({
                                user_id: projData.client_id,
                                title: "New Deliverable Uploaded",
                                message: `A new video deliverable "${itemTitle}" has been uploaded for your project "${projData.name}". You can now view and download it!`
                            });
                        } catch (err) {
                            console.error("Error creating video notification:", err);
                        }
                    }
                }
                alert(`Uploaded ${files.length} video(s) successfully!`);
            }

            closeModals();
            loadViewData('videos');
            if (typeof loadClientVideosData === 'function') {
                loadClientVideosData();
            }
        } catch (err) {
            console.error("Error handling video form:", err);
            alert("Error: " + (err.message || err));
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = editStates.video ? 'Save Changes' : 'Upload Video';
        }
    });

    document.getElementById('formAddPetrol').addEventListener('submit', async (e) => {
        e.preventDefault();
        const client_id = document.getElementById('peClientSelect').value || null;
        const date = document.getElementById('peDate').value;
        const vehicle_type = document.getElementById('peVehicle').value;
        const starting_km = parseFloat(document.getElementById('peStartKm').value);
        const ending_km = parseFloat(document.getElementById('peEndKm').value);
        const petrol_cost = parseFloat(document.getElementById('peCost').value);
        const notes = document.getElementById('peNotes').value;

        const startPhotoFile = document.getElementById('peStartPhoto').files[0];
        const endPhotoFile = document.getElementById('peEndPhoto').files[0];

        let start_photo_url = null;
        let end_photo_url = null;

        if (startPhotoFile) {
            const ext = startPhotoFile.name.split('.').pop();
            const path = `start_${Math.random()}.${ext}`;
            const { data, error } = await supabaseClient.storage.from('odometer_photos').upload(path, startPhotoFile);
            if (error) {
                alert('Start photo upload error: ' + error.message);
                return;
            }
            start_photo_url = data.path;
        }

        if (endPhotoFile) {
            const ext = endPhotoFile.name.split('.').pop();
            const path = `end_${Math.random()}.${ext}`;
            const { data, error } = await supabaseClient.storage.from('odometer_photos').upload(path, endPhotoFile);
            if (error) {
                alert('End photo upload error: ' + error.message);
                return;
            }
            end_photo_url = data.path;
        }

        let res;
        const fields = { client_id, date, vehicle_type, starting_km, ending_km, petrol_cost, notes };
        if (start_photo_url) fields.start_photo_url = start_photo_url;
        if (end_photo_url) fields.end_photo_url = end_photo_url;

        if (editStates.petrol) {
            res = await supabaseClient.from('petrol_expenses').update(fields).eq('id', editStates.petrol);
        } else {
            res = await supabaseClient.from('petrol_expenses').insert(fields);
        }

        if (res.error) {
            alert('Error: ' + res.error.message);
        } else {
            alert(editStates.petrol ? 'Petrol log updated successfully!' : 'Petrol log created successfully!');
            closeModals();
            loadViewData('petrol');
        }
    });

    document.getElementById('formAddPayment').addEventListener('submit', async (e) => {
        e.preventDefault();
        const client_id = document.getElementById('payClientSelect').value;
        const project_id = document.getElementById('payProjectSelect').value;
        const total_amount = parseFloat(document.getElementById('payTotal').value);
        const amount_received = parseFloat(document.getElementById('payReceived').value);
        const payment_date = document.getElementById('payDate').value;
        const payment_method = document.getElementById('payMethod').value;
        const notes = document.getElementById('payNotes').value;

        let res;
        if (editStates.payment) {
            res = await supabaseClient.from('payments').update({
                client_id, project_id, total_amount, amount_received, payment_date, payment_method, notes
            }).eq('id', editStates.payment);
        } else {
            res = await supabaseClient.from('payments').insert({
                client_id, project_id, total_amount, amount_received, payment_date, payment_method, notes
            });
        }

        if (res.error) {
            alert('Error: ' + res.error.message);
        } else {
            // Trigger client notification
            try {
                let projectName = "your project";
                if (project_id) {
                    const { data: projData } = await supabaseClient.from('projects').select('name').eq('id', project_id).single();
                    if (projData) projectName = `"${projData.name}"`;
                }

                const notificationTitle = editStates.payment ? "Payment Record Updated" : "Payment Received";
                const notificationMessage = editStates.payment
                    ? `Your payment record for project ${projectName} has been updated. Amount received: ₹${amount_received}. Remaining balance: ₹${total_amount - amount_received}.`
                    : `We have received a payment of ₹${amount_received} for project ${projectName}. Remaining balance: ₹${total_amount - amount_received}.`;

                await supabaseClient.from('notifications').insert({
                    user_id: client_id,
                    title: notificationTitle,
                    message: notificationMessage
                });
            } catch (err) {
                console.error("Error creating payment notification:", err);
            }

            alert(editStates.payment ? 'Payment updated successfully!' : 'Payment recorded successfully!');
            closeModals();
            loadViewData('payments');
        }
    });
});

// Edit functions exposed globally to triggers in HTML tables
window.editClient = async (id) => {
    const { data } = await supabaseClient.from('profiles').select('*').eq('id', id).single();
    if (data) {
        editStates.client = id;
        document.getElementById('clientModalTitle').textContent = 'Edit Client';
        document.getElementById('clientSubmitBtn').textContent = 'Save Changes';
        document.getElementById('clientAuthFields').classList.add('hidden');
        document.getElementById('cEmail').required = false;
        document.getElementById('cPassword').required = false;

        document.getElementById('cName').value = data.full_name || '';
        document.getElementById('cCompany').value = data.company_name || '';
        openModal('clientModal');
    }
};

window.editProject = async (id) => {
    const { data } = await supabaseClient.from('projects').select('*').eq('id', id).single();
    if (data) {
        editStates.project = id;
        document.getElementById('projectModalTitle').textContent = 'Edit Project';

        await populateClientsDropdown('pClientSelect');
        document.getElementById('pClientSelect').value = data.client_id;
        document.getElementById('pName').value = data.name;
        document.getElementById('pType').value = data.project_type;
        document.getElementById('pDesc').value = data.description || '';
        document.getElementById('pStart').value = data.start_date;
        document.getElementById('pDue').value = data.due_date;
        document.getElementById('pStatus').value = data.status;

        openModal('projectModal');
    }
};

window.editVideo = async (id) => {
    const { data } = await supabaseClient.from('videos').select('*').eq('id', id).single();
    if (data) {
        editStates.video = id;
        document.getElementById('videoModalTitle').textContent = 'Edit Video';

        await populateProjectsDropdown('vProjectSelect');
        document.getElementById('vProjectSelect').value = data.project_id;
        document.getElementById('vTitle').value = data.title;
        document.getElementById('vDesc').value = data.description || '';
        
        const vFileEl = document.getElementById('vFile');
        vFileEl.required = false;
        vFileEl.removeAttribute('multiple');
        document.getElementById('vFileLabel').textContent = 'Select Video File (Optional)';

        openModal('videoModal');
    }
};

window.editPetrol = async (id) => {
    const { data } = await supabaseClient.from('petrol_expenses').select('*').eq('id', id).single();
    if (data) {
        editStates.petrol = id;
        document.getElementById('petrolModalTitle').textContent = 'Edit Petrol Log';

        await populateClientsDropdown('peClientSelect');
        document.getElementById('peClientSelect').value = data.client_id || '';
        document.getElementById('peDate').value = data.date;
        document.getElementById('peVehicle').value = data.vehicle_type;
        document.getElementById('peStartKm').value = data.starting_km;
        document.getElementById('peEndKm').value = data.ending_km;
        document.getElementById('peCost').value = data.petrol_cost;
        document.getElementById('peNotes').value = data.notes || '';

        openModal('petrolModal');
    }
};

window.editPayment = async (id) => {
    const { data } = await supabaseClient.from('payments').select('*').eq('id', id).single();
    if (data) {
        editStates.payment = id;
        document.getElementById('paymentModalTitle').textContent = 'Edit Payment';

        await populateClientsDropdown('payClientSelect');
        await populateProjectsDropdown('payProjectSelect');
        document.getElementById('payClientSelect').value = data.client_id;
        document.getElementById('payProjectSelect').value = data.project_id || '';
        document.getElementById('payTotal').value = data.total_amount;
        document.getElementById('payReceived').value = data.amount_received;
        document.getElementById('payDate').value = data.payment_date;
        document.getElementById('payMethod').value = data.payment_method || '';
        document.getElementById('payNotes').value = data.notes || '';

        openModal('paymentModal');
    }
};

async function populateClientsDropdown(selectId) {
    const selectEl = document.getElementById(selectId);
    if (!selectEl) return;
    const { data } = await supabaseClient.from('profiles').select('id, full_name, company_name').eq('role', 'client');
    if (data) {
        selectEl.innerHTML = selectId === 'peClientSelect' ? '<option value="">General / None</option>' : '';
        data.forEach(client => {
            const label = client.company_name ? `${client.full_name} (${client.company_name})` : client.full_name;
            selectEl.innerHTML += `<option value="${client.id}">${label}</option>`;
        });
    }
}

async function populateProjectsDropdown(selectId) {
    const selectEl = document.getElementById(selectId);
    if (!selectEl) return;
    const { data } = await supabaseClient.from('projects').select('id, name');
    if (data) {
        selectEl.innerHTML = '';
        data.forEach(project => {
            selectEl.innerHTML += `<option value="${project.id}">${project.name}</option>`;
        });
    }
}

async function loadViewData(view) {
    if (view === 'dashboard') {
        loadDashboardData();
    } else if (view === 'clients') {
        loadClientsData();
    } else if (view === 'projects') {
        loadProjectsData();
    } else if (view === 'videos') {
        loadVideosData();
    } else if (view === 'client-videos') {
        loadClientVideosData();
    } else if (view === 'petrol') {
        loadPetrolData();
    } else if (view === 'payments') {
        loadPaymentsData();
    }
}

async function loadDashboardData() {
    const { data: projects } = await supabaseClient.from('projects').select('id', { count: 'exact' }).in('status', ['Pending', 'Shooting', 'Editing', 'Review']);
    document.getElementById('kpiProjects').textContent = projects?.length || 0;

    // Fetch payments to calculate revenue
    const { data: payments } = await supabaseClient.from('payments').select('amount_received, remaining_amount');
    let totalRev = 0;
    let pendingRev = 0;
    if (payments) {
        payments.forEach(p => {
            totalRev += Number(p.amount_received) || 0;
            pendingRev += Number(p.remaining_amount) || 0;
        });
    }

    // Fetch petrol expenses
    const { data: petrolExpenses } = await supabaseClient.from('petrol_expenses').select('petrol_cost');
    let totalPetrolExpense = 0;
    if (petrolExpenses) {
        petrolExpenses.forEach(pe => {
            totalPetrolExpense += Number(pe.petrol_cost) || 0;
        });
    }

    // Fetch general expenses
    const { data: generalExpenses } = await supabaseClient.from('expenses').select('amount');
    let totalGeneralExpense = 0;
    if (generalExpenses) {
        generalExpenses.forEach(ge => {
            totalGeneralExpense += Number(ge.amount) || 0;
        });
    }

    const totalExpenses = totalPetrolExpense + totalGeneralExpense;
    const netProfit = totalRev - totalExpenses;

    document.getElementById('kpiRevenue').textContent = '₹' + totalRev;
    document.getElementById('kpiProfit').textContent = '₹' + netProfit;
    document.getElementById('kpiPending').textContent = '₹' + pendingRev;

    initCharts();
}

function initCharts() {
    const revCtx = document.getElementById('revenueChart');
    if(charts.rev) charts.rev.destroy();
    charts.rev = new Chart(revCtx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
                label: 'Revenue',
                data: [1200, 1900, 3000, 5000, 2000, 3000],
                borderColor: '#0ea5e9',
                tension: 0.4
            }]
        }
    });

    const expCtx = document.getElementById('expensesChart');
    if(charts.exp) charts.exp.destroy();
    charts.exp = new Chart(expCtx, {
        type: 'doughnut',
        data: {
            labels: ['Petrol', 'Software', 'Equipment'],
            datasets: [{
                data: [300, 50, 100],
                backgroundColor: ['#0ea5e9', '#8b5cf6', '#f59e0b']
            }]
        }
    });
}

async function loadClientsData() {
    const { data } = await supabaseClient.from('profiles').select('*').eq('role', 'client');
    const tbody = document.getElementById('clientsTableBody');
    const cardsContainer = document.getElementById('clientsCards');
    tbody.innerHTML = '';
    if (cardsContainer) cardsContainer.innerHTML = '';
    
    if (data) {
        data.forEach(client => {
            // Render table row (desktop)
            tbody.innerHTML += `
                <tr>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">${client.full_name || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${client.company_name || '-'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${client.id}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onclick="editClient('${client.id}')" class="text-brand-600 hover:text-brand-900 mr-3"><i class="fa-solid fa-edit"></i> Edit</button>
                        <button onclick="deleteClient('${client.id}')" class="text-red-600 hover:text-red-900"><i class="fa-solid fa-trash"></i> Delete</button>
                    </td>
                </tr>
            `;
            // Render card (mobile)
            if (cardsContainer) {
                cardsContainer.innerHTML += `
                    <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 space-y-2 text-sm">
                        <div class="flex justify-between items-center">
                            <span class="font-bold text-gray-900 dark:text-white">${client.full_name || 'N/A'}</span>
                            <div class="flex items-center space-x-3">
                                <button onclick="editClient('${client.id}')" class="text-brand-600 hover:text-brand-900 text-xs font-semibold"><i class="fa-solid fa-edit mr-1"></i>Edit</button>
                                <button onclick="deleteClient('${client.id}')" class="text-red-600 hover:text-red-900 text-xs font-semibold"><i class="fa-solid fa-trash mr-1"></i>Delete</button>
                            </div>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-500 dark:text-gray-400">Company</span>
                            <span class="text-gray-950 dark:text-gray-200 font-medium">${client.company_name || '-'}</span>
                        </div>
                        <div class="flex justify-between text-xs text-gray-400">
                            <span>ID</span>
                            <span class="font-mono truncate max-w-[200px]">${client.id}</span>
                        </div>
                    </div>
                `;
            }
        });
    }
}

async function loadProjectsData() {
    const { data } = await supabaseClient.from('projects').select('*, profiles(full_name, company_name)').order('created_at', { ascending: false });
    const container = document.getElementById('projectsList');
    container.innerHTML = '';
    if (data) {
        data.forEach(project => {
            const statusColors = {
                'Pending': 'bg-gray-100 text-gray-800',
                'Shooting': 'bg-blue-100 text-blue-800',
                'Editing': 'bg-purple-100 text-purple-800',
                'Review': 'bg-orange-100 text-orange-800',
                'Delivered': 'bg-green-100 text-green-800',
                'Completed': 'bg-emerald-100 text-emerald-800'
            };
            const badgeClass = statusColors[project.status] || 'bg-gray-100 text-gray-800';
            container.innerHTML += `
                <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div class="flex justify-between items-start mb-4">
                        <h4 class="text-md font-semibold text-gray-900 dark:text-white">${project.name}</h4>
                        <span class="px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}">${project.status}</span>
                    </div>
                    <p class="text-xs text-gray-500 mb-2">Client: ${project.profiles?.full_name || 'N/A'}</p>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">${project.description || 'No description'}</p>
                    <div class="flex justify-between text-xs text-gray-500">
                        <span>Start: ${new Date(project.start_date).toLocaleDateString()}</span>
                        <span>Due: ${new Date(project.due_date).toLocaleDateString()}</span>
                    </div>
                    <div class="flex space-x-3 mt-4">
                        <button onclick="editProject('${project.id}')" class="text-brand-600 hover:text-brand-900 text-xs font-semibold">
                            <i class="fa-solid fa-edit mr-1"></i> Edit Project
                        </button>
                        <button onclick="deleteProject('${project.id}')" class="text-red-600 hover:text-red-900 text-xs font-semibold">
                            <i class="fa-solid fa-trash mr-1"></i> Delete
                        </button>
                    </div>
                </div>
            `;
        });
    }
}

async function loadVideosData() {
    const { data } = await supabaseClient.from('videos').select('*, projects(name)').order('upload_date', { ascending: false });
    const container = document.getElementById('videosList');
    container.innerHTML = '';
    
    let count = 0;
    if (data) {
        data.forEach(video => {
            if (video.is_client_uploaded) return; // Skip client uploads
            count++;
            
            container.innerHTML += `
                <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <div class="flex items-center">
                        <div class="h-12 w-12 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center text-xl mr-4">
                            <i class="fa-solid fa-play"></i>
                        </div>
                        <div>
                            <h4 class="text-md font-semibold text-gray-900 dark:text-white">${video.title}</h4>
                            <p class="text-xs text-gray-500">Project: ${video.projects?.name || 'N/A'}</p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2">
                        <button onclick="editVideo('${video.id}')" class="text-brand-600 hover:text-brand-900">
                            <i class="fa-solid fa-edit text-lg"></i>
                        </button>
                        <button onclick="deleteVideo('${video.id}', '${video.file_url}')" class="text-red-600 hover:text-red-900" title="Delete Video">
                            <i class="fa-solid fa-trash text-lg"></i>
                        </button>
                        <button onclick="downloadFile('videos', '${video.file_url}', '${video.title.replace(/'/g, "\\'")}')" class="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 p-2 rounded-lg transition-colors" title="Download Video">
                            <i class="fa-solid fa-download"></i>
                        </button>
                    </div>
                </div>
            `;
        });
    }
    
    if (count === 0) {
        container.innerHTML = '<p class="text-gray-500 text-sm">No videos uploaded by admin yet.</p>';
    }
}

async function loadClientVideosData() {
    const { data } = await supabaseClient.from('videos')
        .select('*, projects(name, profiles(full_name))')
        .order('upload_date', { ascending: false });
        
    const container = document.getElementById('clientVideosList');
    container.innerHTML = '';
    
    let count = 0;
    if (data) {
        data.forEach(video => {
            if (!video.is_client_uploaded) return; // Only client uploads
            count++;
            
            container.innerHTML += `
                <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <div class="flex items-center min-w-0 mr-4">
                        <div class="flex-shrink-0 h-12 w-12 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center text-xl mr-4">
                            <i class="fa-solid fa-play"></i>
                        </div>
                        <div class="min-w-0">
                            <h4 class="text-md font-semibold text-gray-900 dark:text-white truncate">${video.title}</h4>
                            <p class="text-xs text-gray-500 truncate">Project: ${video.projects?.name || 'N/A'}</p>
                            <p class="text-xxs text-brand-600 dark:text-brand-400 font-semibold truncate">Uploaded by Client: ${video.projects?.profiles?.full_name || 'N/A'}</p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2">
                        <button onclick="editVideo('${video.id}')" class="text-brand-600 hover:text-brand-900">
                            <i class="fa-solid fa-edit text-lg"></i>
                        </button>
                        <button onclick="deleteVideo('${video.id}', '${video.file_url}')" class="text-red-600 hover:text-red-900" title="Delete Video">
                            <i class="fa-solid fa-trash text-lg"></i>
                        </button>
                        <button onclick="downloadFile('videos', '${video.file_url}', '${video.title.replace(/'/g, "\\'")}')" class="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 p-2 rounded-lg transition-colors" title="Download Video">
                            <i class="fa-solid fa-download"></i>
                        </button>
                    </div>
                </div>
            `;
        });
    }
    
    if (count === 0) {
        container.innerHTML = '<p class="text-gray-500 text-sm">No client videos uploaded yet.</p>';
    }
}

async function loadPetrolData() {
    const { data } = await supabaseClient.from('petrol_expenses').select('*, profiles(full_name, company_name)').order('date', { ascending: false });
    const tbody = document.getElementById('petrolTableBody');
    const cardsContainer = document.getElementById('petrolCards');
    tbody.innerHTML = '';
    if (cardsContainer) cardsContainer.innerHTML = '';
    
    if (data) {
        data.forEach(entry => {
            let startPhotoHtml = '-';
            let endPhotoHtml = '-';

            if (entry.start_photo_url) {
                const { data: startUrl } = supabaseClient.storage.from('odometer_photos').getPublicUrl(entry.start_photo_url);
                startPhotoHtml = `<a href="${startUrl.publicUrl}" target="_blank" class="text-brand-600 hover:text-brand-900 text-xs font-semibold mr-2"><i class="fa-solid fa-image mr-1"></i>Start</a>`;
            }
            if (entry.end_photo_url) {
                const { data: endUrl } = supabaseClient.storage.from('odometer_photos').getPublicUrl(entry.end_photo_url);
                endPhotoHtml = `<a href="${endUrl.publicUrl}" target="_blank" class="text-brand-600 hover:text-brand-900 text-xs font-semibold"><i class="fa-solid fa-image mr-1"></i>End</a>`;
            }

            // Render table row (desktop)
            tbody.innerHTML += `
                <tr>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">${new Date(entry.date).toLocaleDateString()}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${entry.profiles?.full_name || 'General'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${entry.total_km} km</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-semibold">₹${entry.petrol_cost}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${startPhotoHtml} / ${endPhotoHtml}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onclick="editPetrol('${entry.id}')" class="text-brand-600 hover:text-brand-900 mr-2"><i class="fa-solid fa-edit"></i> Edit</button>
                        <button onclick="deletePetrol('${entry.id}', '${entry.start_photo_url || ''}', '${entry.end_photo_url || ''}')" class="text-red-600 hover:text-red-900"><i class="fa-solid fa-trash"></i> Delete</button>
                    </td>
                </tr>
            `;

            // Render card (mobile)
            if (cardsContainer) {
                cardsContainer.innerHTML += `
                    <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 space-y-2 text-sm">
                        <div class="flex justify-between items-center">
                            <span class="text-xs text-gray-500 dark:text-gray-400 font-medium">${new Date(entry.date).toLocaleDateString()}</span>
                            <div class="flex items-center space-x-3">
                                <span class="font-bold text-gray-900 dark:text-white">₹${entry.petrol_cost}</span>
                                <button onclick="editPetrol('${entry.id}')" class="text-brand-600 hover:text-brand-900 text-xs font-semibold"><i class="fa-solid fa-edit"></i></button>
                                <button onclick="deletePetrol('${entry.id}', '${entry.start_photo_url || ''}', '${entry.end_photo_url || ''}')" class="text-red-600 hover:text-red-900 text-xs font-semibold"><i class="fa-solid fa-trash"></i></button>
                            </div>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-500 dark:text-gray-400">Client/Project</span>
                            <span class="font-medium text-gray-800 dark:text-gray-200">${entry.profiles?.full_name || 'General'}</span>
                        </div>
                        <div class="grid grid-cols-2 gap-2 pt-1.5 border-t border-gray-100 dark:border-gray-700">
                            <div>
                                <span class="block text-xxs uppercase tracking-wider text-gray-400">Total KM</span>
                                <span class="font-medium">${entry.total_km} km</span>
                            </div>
                            <div>
                                <span class="block text-xxs uppercase tracking-wider text-gray-400">Odometer</span>
                                <span class="font-medium">${startPhotoHtml} / ${endPhotoHtml}</span>
                            </div>
                        </div>
                    </div>
                `;
            }
        });
    }
}

async function loadPaymentsData() {
    const { data } = await supabaseClient.from('payments').select('*, profiles(full_name), projects(name)').order('payment_date', { ascending: false });
    const tbody = document.getElementById('paymentsTableBody');
    const cardsContainer = document.getElementById('paymentsCards');
    tbody.innerHTML = '';
    if (cardsContainer) cardsContainer.innerHTML = '';

    if (data) {
        data.forEach(payment => {
            // Render table row (desktop)
            tbody.innerHTML += `
                <tr>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">${new Date(payment.payment_date).toLocaleDateString()}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${payment.profiles?.full_name || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${payment.projects?.name || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-semibold">₹${payment.amount_received}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${payment.remaining_amount === 0 ? '<span class="text-green-600 font-semibold">Fully Paid</span>' : `<span class="text-orange-600 font-semibold">Pending ₹${payment.remaining_amount}</span>`}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onclick="editPayment('${payment.id}')" class="text-brand-600 hover:text-brand-900 mr-3"><i class="fa-solid fa-edit"></i> Edit</button>
                        <button onclick="deletePayment('${payment.id}')" class="text-red-600 hover:text-red-900"><i class="fa-solid fa-trash"></i> Delete</button>
                    </td>
                </tr>
            `;

            // Render card (mobile)
            if (cardsContainer) {
                const statusHtml = payment.remaining_amount === 0 
                    ? '<span class="text-xs px-2.5 py-0.5 rounded-full bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 font-semibold">Fully Paid</span>' 
                    : `<span class="text-xs px-2.5 py-0.5 rounded-full bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 font-semibold">Pending ₹${payment.remaining_amount}</span>`;

                cardsContainer.innerHTML += `
                    <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 space-y-2 text-sm">
                        <div class="flex justify-between items-center">
                            <span class="text-xs text-gray-500 dark:text-gray-400 font-medium">${new Date(payment.payment_date).toLocaleDateString()}</span>
                            <div class="flex items-center space-x-3">
                                ${statusHtml}
                                <button onclick="editPayment('${payment.id}')" class="text-brand-600 hover:text-brand-900 text-xs font-semibold"><i class="fa-solid fa-edit"></i></button>
                                <button onclick="deletePayment('${payment.id}')" class="text-red-600 hover:text-red-900 text-xs font-semibold"><i class="fa-solid fa-trash"></i></button>
                            </div>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-500 dark:text-gray-400">Client</span>
                            <span class="font-medium text-gray-800 dark:text-gray-200">${payment.profiles?.full_name || 'N/A'}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-500 dark:text-gray-400">Project</span>
                            <span class="font-medium text-gray-800 dark:text-gray-200">${payment.projects?.name || 'N/A'}</span>
                        </div>
                        <div class="flex justify-between pt-1 border-t border-gray-150 dark:border-gray-700">
                            <span class="text-gray-500 dark:text-gray-400">Amount Received</span>
                            <span class="font-bold text-green-600">₹${payment.amount_received}</span>
                        </div>
                    </div>
                `;
            }
        });
    }
}

async function downloadFile(bucket, filePath, fileName) {
    try {
        document.body.style.cursor = 'wait';
        const { data, error } = await supabaseClient.storage.from(bucket).download(filePath);
        if (error) throw error;
        
        const blobUrl = URL.createObjectURL(data);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName || filePath.split('/').pop() || 'download';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
    } catch (err) {
        console.error("Download failed:", err);
        alert("Failed to download file: " + (err.message || err));
    } finally {
        document.body.style.cursor = 'default';
    }
}
window.downloadFile = downloadFile;

// Delete functions exposed globally to triggers in HTML tables
window.deleteClient = async (id) => {
    if (!confirm("Are you sure you want to delete this client? This will delete their profile.")) return;
    try {
        const { error } = await supabaseClient.from('profiles').delete().eq('id', id);
        if (error) throw error;
        alert("Client deleted successfully!");
        loadClientsData();
    } catch (err) {
        console.error("Error deleting client:", err);
        alert("Failed to delete client: " + (err.message || err));
    }
};

window.deleteProject = async (id) => {
    if (!confirm("Are you sure you want to delete this project? All associated deliverables and records will be deleted.")) return;
    try {
        // Fetch any videos for this project so we can delete files from storage
        const { data: videos } = await supabaseClient.from('videos').select('file_url').eq('project_id', id);
        if (videos && videos.length > 0) {
            const filesToRemove = videos.map(v => v.file_url);
            await supabaseClient.storage.from('videos').remove(filesToRemove);
        }

        const { error } = await supabaseClient.from('projects').delete().eq('id', id);
        if (error) throw error;
        alert("Project deleted successfully!");
        loadProjectsData();
    } catch (err) {
        console.error("Error deleting project:", err);
        alert("Failed to delete project: " + (err.message || err));
    }
};

window.deleteVideo = async (id, fileUrl) => {
    if (!confirm("Are you sure you want to delete this video? This will also remove the file from storage.")) return;
    try {
        // Delete from storage
        if (fileUrl) {
            const { error: storageError } = await supabaseClient.storage.from('videos').remove([fileUrl]);
            if (storageError) console.error("Warning: Storage delete error:", storageError);
        }
        
        // Delete database record
        const { error } = await supabaseClient.from('videos').delete().eq('id', id);
        if (error) throw error;
        
        alert("Video deleted successfully!");
        loadVideosData();
        if (typeof loadClientVideosData === 'function') {
            loadClientVideosData();
        }
    } catch (err) {
        console.error("Error deleting video:", err);
        alert("Failed to delete video: " + (err.message || err));
    }
};

window.deletePetrol = async (id, startPhotoUrl, endPhotoUrl) => {
    if (!confirm("Are you sure you want to delete this petrol log and its odometer photos?")) return;
    try {
        // Delete photos from storage
        let filesToRemove = [];
        if (startPhotoUrl && startPhotoUrl !== '-') filesToRemove.push(startPhotoUrl);
        if (endPhotoUrl && endPhotoUrl !== '-') filesToRemove.push(endPhotoUrl);
        if (filesToRemove.length > 0) {
            const { error: storageError } = await supabaseClient.storage.from('odometer_photos').remove(filesToRemove);
            if (storageError) console.error("Warning: Storage photos delete error:", storageError);
        }
        
        // Delete record from DB
        const { error } = await supabaseClient.from('petrol_expenses').delete().eq('id', id);
        if (error) throw error;
        
        alert("Petrol log deleted successfully!");
        loadPetrolData();
    } catch (err) {
        console.error("Error deleting petrol log:", err);
        alert("Failed to delete petrol log: " + (err.message || err));
    }
};

window.deletePayment = async (id) => {
    if (!confirm("Are you sure you want to delete this payment record?")) return;
    try {
        const { error } = await supabaseClient.from('payments').delete().eq('id', id);
        if (error) throw error;
        alert("Payment record deleted successfully!");
        loadPaymentsData();
    } catch (err) {
        console.error("Error deleting payment:", err);
        alert("Failed to delete payment: " + (err.message || err));
    }
};
