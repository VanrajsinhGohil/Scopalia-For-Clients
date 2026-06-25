// js/client.js

let currentUserId = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Check Auth
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'index.html';
        return;
    }
    
    currentUserId = session.user.id;
    
    // Verify Role
    const { data: profile } = await supabaseClient.from('profiles').select('role').eq('id', currentUserId).single();
    if (profile && profile.role === 'admin') {
        window.location.href = 'admin.html'; // Admin shouldn't be here typically
        return;
    }

    // Auth verification succeeded, show body
    document.body.style.display = 'block';

    // Initialize Notifications
    initNotifications();

    // Navigation
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const mobileMenu = document.getElementById('mobileMenu');

    const navLinks = document.querySelectorAll('.nav-link');
    const viewSections = document.querySelectorAll('.view-section');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const viewId = link.getAttribute('data-view');
            
            // Sync all navigation links with the same viewId (mobile and desktop)
            navLinks.forEach(l => {
                if (l.getAttribute('data-view') === viewId) {
                    l.classList.add('active');
                } else {
                    l.classList.remove('active');
                }
            });
            
            viewSections.forEach(v => v.classList.remove('active'));
            document.getElementById(`view-${viewId}`).classList.add('active');
            
            // Close mobile menu if open
            if (mobileMenu) {
                mobileMenu.classList.add('hidden');
            }

            loadClientData(viewId);
        });
    });

    if (mobileMenuToggle && mobileMenu) {
        mobileMenuToggle.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }

    // Modals
    window.openUploadModal = async () => {
        document.getElementById('modalOverlay').classList.remove('hidden');
        document.getElementById('uploadModal').classList.remove('hidden');
        
        const selectEl = document.getElementById('uvProjectSelect');
        selectEl.innerHTML = '<option value="">Loading projects...</option>';
        
        const { data: projects, error } = await supabaseClient.from('projects').select('id, name');
        if (error || !projects || projects.length === 0) {
            selectEl.innerHTML = '<option value="">No projects available</option>';
            return;
        }
        
        selectEl.innerHTML = '<option value="">-- Choose a Project --</option>';
        projects.forEach(project => {
            selectEl.innerHTML += `<option value="${project.id}">${project.name}</option>`;
        });
    };

    window.closeModals = () => {
        document.getElementById('modalOverlay').classList.add('hidden');
        document.getElementById('uploadModal').classList.add('hidden');
        document.getElementById('receiptModal').classList.add('hidden');
        document.getElementById('formUploadVideo').reset();
    };

    const formUploadVideo = document.getElementById('formUploadVideo');
    if (formUploadVideo) {
        formUploadVideo.addEventListener('submit', async (e) => {
            e.preventDefault();
            const projectEl = document.getElementById('uvProjectSelect');
            const titleEl = document.getElementById('uvTitle');
            const fileEl = document.getElementById('uvFile');
            const submitBtn = document.getElementById('btnUploadSubmit');
            
            const projectId = projectEl.value;
            const title = titleEl.value;
            const files = fileEl.files;
            
            if (!projectId || !title || !files || files.length === 0) {
                alert("Please select a project, enter a title, and choose at least one video file.");
                return;
            }
            
            try {
                submitBtn.disabled = true;
                
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i> Uploading ${i + 1}/${files.length}...`;
                    
                    const fileExt = file.name.split('.').pop();
                    const path = `${projectId}_client_${Math.random()}.${fileExt}`;
                    
                    // Upload file to storage
                    const { data: storageData, error: storageError } = await supabaseClient.storage
                        .from('videos')
                        .upload(path, file);
                        
                    if (storageError) throw storageError;
                    
                    // Construct a clean title for each file
                    const fileNameOnly = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                    const itemTitle = files.length > 1 ? `${title} - ${fileNameOnly}` : title;
                    
                    // Insert into videos table
                    const { error: dbError } = await supabaseClient.from('videos').insert({
                        project_id: projectId,
                        title: itemTitle,
                        file_url: path,
                        file_size: file.size,
                        is_client_uploaded: true,
                        uploaded_by: currentUserId
                    });
                    
                    if (dbError) throw dbError;
                }
                
                alert(`Uploaded ${files.length} video(s) successfully!`);
                closeModals();
                loadMyVideos();
            } catch (err) {
                console.error("Upload error:", err);
                alert("Upload failed: " + (err.message || err));
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up mr-2"></i> Upload Video`;
            }
        });
    }

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.href = 'index.html';
    });

    // Load initial view
    loadClientData('projects');
});

async function loadClientData(view) {
    if (view === 'projects') {
        loadMyProjects();
    } else if (view === 'videos') {
        loadMyVideos();
    } else if (view === 'payments') {
        loadMyPayments();
    } else if (view === 'petrol') {
        loadMyPetrol();
    }
}

async function loadMyProjects() {
    const { data, error } = await supabaseClient.from('projects').select('*').order('created_at', { ascending: false });
    const container = document.getElementById('clientProjectsList');
    container.innerHTML = '';

    if (error) {
        console.error("Error fetching projects", error);
        return;
    }

    if (data.length === 0) {
        container.innerHTML = `<p class="text-gray-500">No projects found.</p>`;
        return;
    }

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
            <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow">
                <div class="flex justify-between items-start mb-4">
                    <h3 class="text-lg font-semibold text-gray-900 dark:text-white">${project.name}</h3>
                    <span class="px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}">${project.status}</span>
                </div>
                <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">${project.description || 'No description provided.'}</p>
                <div class="flex justify-between text-sm text-gray-500">
                    <span><i class="fa-regular fa-calendar mr-1"></i> Due: ${new Date(project.due_date).toLocaleDateString()}</span>
                </div>
            </div>
        `;
    });
}

async function loadMyVideos() {
    // Requires mapping through projects due to RLS
    const { data, error } = await supabaseClient.from('videos').select('*, projects!inner(name)').order('upload_date', { ascending: false });
    const deliverablesContainer = document.getElementById('clientVideosList');
    const uploadsContainer = document.getElementById('clientMyUploadsList');
    
    deliverablesContainer.innerHTML = '';
    uploadsContainer.innerHTML = '';

    if (error) {
        console.error("Error fetching videos", error);
        return;
    }

    let deliverablesCount = 0;
    let uploadsCount = 0;

    if (data) {
        data.forEach(video => {
            let actionButtons = `
                <div class="flex items-center space-x-2 flex-shrink-0">
                    <button onclick="downloadFile('videos', '${video.file_url}', '${video.title.replace(/'/g, "\\'")}')" class="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 p-2 rounded-lg transition-colors" title="Download Video">
                        <i class="fa-solid fa-download"></i>
                    </button>
            `;
            
            if (video.is_client_uploaded) {
                actionButtons += `
                    <button onclick="deleteMyVideo('${video.id}', '${video.file_url}')" class="bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 p-2 rounded-lg transition-colors" title="Delete Video">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                `;
            }
            actionButtons += `</div>`;

            const videoCard = `
                <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between min-w-0">
                    <div class="flex items-center min-w-0 mr-4">
                        <div class="flex-shrink-0 h-12 w-12 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center text-xl mr-4">
                            <i class="fa-solid fa-play"></i>
                        </div>
                        <div class="min-w-0">
                            <h4 class="text-md font-semibold text-gray-900 dark:text-white truncate">${video.title}</h4>
                            <p class="text-xs text-gray-500 truncate">Project: ${video.projects?.name || 'N/A'}</p>
                        </div>
                    </div>
                    ${actionButtons}
                </div>
            `;
            
            if (video.is_client_uploaded) {
                uploadsContainer.innerHTML += videoCard;
                uploadsCount++;
            } else {
                deliverablesContainer.innerHTML += videoCard;
                deliverablesCount++;
            }
        });
    }

    if (deliverablesCount === 0) {
        deliverablesContainer.innerHTML = `<p class="text-gray-500 text-sm">No deliverables uploaded by admin yet.</p>`;
    }
    if (uploadsCount === 0) {
        uploadsContainer.innerHTML = `<p class="text-gray-500 text-sm">You haven't uploaded any videos yet.</p>`;
    }
}

async function loadMyPayments() {
    const { data, error } = await supabaseClient.from('payments').select('*, projects(name)').order('payment_date', { ascending: false });
    const tbody = document.getElementById('clientPaymentsBody');
    const cardsContainer = document.getElementById('clientPaymentsCards');
    tbody.innerHTML = '';
    if (cardsContainer) cardsContainer.innerHTML = '';

    if (error) {
        console.error("Error fetching payments:", error);
        return;
    }

    if (data) {
        data.forEach(payment => {
            // Render table row (desktop)
            tbody.innerHTML += `
                <tr>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">${new Date(payment.payment_date).toLocaleDateString()}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">₹${payment.amount_received}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-red-500 font-semibold">₹${payment.remaining_amount}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${payment.payment_method || '-'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onclick="viewReceipt('${payment.id}')" class="text-brand-600 hover:text-brand-900 font-semibold inline-flex items-center space-x-1">
                            <i class="fa-solid fa-receipt"></i> <span>Receipt</span>
                        </button>
                    </td>
                </tr>
            `;
            // Render card (mobile)
            if (cardsContainer) {
                cardsContainer.innerHTML += `
                    <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 space-y-2 text-sm">
                        <div class="flex justify-between items-center">
                            <span class="text-xs text-gray-500 dark:text-gray-400 font-medium">${new Date(payment.payment_date).toLocaleDateString()}</span>
                            <div class="flex items-center space-x-2">
                                <span class="text-xs px-2.5 py-0.5 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 font-semibold">${payment.payment_method || '-'}</span>
                                <button onclick="viewReceipt('${payment.id}')" class="text-brand-600 hover:text-brand-900 font-semibold p-1" title="View Receipt">
                                    <i class="fa-solid fa-receipt text-base"></i>
                                </button>
                            </div>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-500 dark:text-gray-400">Amount Paid</span>
                            <span class="font-bold text-green-600">₹${payment.amount_received}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-500 dark:text-gray-400">Remaining</span>
                            <span class="font-bold text-red-500">₹${payment.remaining_amount}</span>
                        </div>
                    </div>
                `;
            }
        });
    }
}

async function loadMyPetrol() {
    const { data, error } = await supabaseClient.from('petrol_expenses').select('*').order('date', { ascending: false });
    const tbody = document.getElementById('clientPetrolBody');
    const cardsContainer = document.getElementById('clientPetrolCards');
    tbody.innerHTML = '';
    if (cardsContainer) cardsContainer.innerHTML = '';

    if (data) {
        data.forEach(petrol => {
            let startPhotoHtml = '-';
            let endPhotoHtml = '-';

            if (petrol.start_photo_url) {
                const { data: startUrl } = supabaseClient.storage.from('odometer_photos').getPublicUrl(petrol.start_photo_url);
                startPhotoHtml = `<a href="${startUrl.publicUrl}" target="_blank" class="text-brand-600 hover:text-brand-900 text-xs font-semibold mr-2"><i class="fa-solid fa-image mr-1"></i>Start</a>`;
            }
            if (petrol.end_photo_url) {
                const { data: endUrl } = supabaseClient.storage.from('odometer_photos').getPublicUrl(petrol.end_photo_url);
                endPhotoHtml = `<a href="${endUrl.publicUrl}" target="_blank" class="text-brand-600 hover:text-brand-900 text-xs font-semibold"><i class="fa-solid fa-image mr-1"></i>End</a>`;
            }

            // Render table row (desktop)
            tbody.innerHTML += `
                <tr>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">${new Date(petrol.date).toLocaleDateString()}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${petrol.vehicle_type}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">${petrol.total_km} km</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₹${petrol.petrol_cost}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${startPhotoHtml} / ${endPhotoHtml}</td>
                </tr>
            `;

            // Render card (mobile)
            if (cardsContainer) {
                cardsContainer.innerHTML += `
                    <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 space-y-2 text-sm">
                        <div class="flex justify-between items-center">
                            <span class="text-xs text-gray-500 dark:text-gray-400 font-medium">${new Date(petrol.date).toLocaleDateString()}</span>
                            <span class="font-bold text-gray-900 dark:text-white">₹${petrol.petrol_cost}</span>
                        </div>
                        <div class="grid grid-cols-2 gap-2 text-gray-600 dark:text-gray-400 pt-1">
                            <div>
                                <span class="block text-xs text-gray-450 uppercase tracking-wider text-gray-400 dark:text-gray-550">Vehicle</span>
                                <span class="font-medium text-gray-800 dark:text-gray-200">${petrol.vehicle_type}</span>
                            </div>
                            <div>
                                <span class="block text-xs text-gray-450 uppercase tracking-wider text-gray-400 dark:text-gray-550">Total KM</span>
                                <span class="font-medium text-gray-800 dark:text-gray-200">${petrol.total_km} km</span>
                            </div>
                        </div>
                        <div class="pt-2 mt-2 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center text-xs">
                            <span class="text-gray-400">Odometer Photos</span>
                            <div>${startPhotoHtml} / ${endPhotoHtml}</div>
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

window.deleteMyVideo = async (id, fileUrl) => {
    if (!confirm("Are you sure you want to delete this video? This will remove the file from storage and clear database records.")) return;
    try {
        document.body.style.cursor = 'wait';
        
        // Delete from storage
        if (fileUrl) {
            const { error: storageError } = await supabaseClient.storage.from('videos').remove([fileUrl]);
            if (storageError) console.error("Warning: Storage delete error:", storageError);
        }
        
        // Delete from database
        const { error } = await supabaseClient.from('videos').delete().eq('id', id);
        if (error) throw error;
        
        alert("Video deleted successfully!");
        loadMyVideos();
    } catch (err) {
        console.error("Error deleting video:", err);
        alert("Failed to delete video: " + (err.message || err));
    } finally {
        document.body.style.cursor = 'default';
    }
};

window.viewReceipt = async (paymentId) => {
    try {
        document.body.style.cursor = 'wait';
        
        const { data: payment, error } = await supabaseClient.from('payments')
            .select('*, projects(name), profiles(full_name, company_name)')
            .eq('id', paymentId)
            .single();
            
        if (error || !payment) {
            throw error || new Error('Payment not found');
        }
        
        const dateStr = new Date(payment.payment_date).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
        const contentEl = document.getElementById('receiptModalContent');
        
        contentEl.innerHTML = `
            <div class="text-center space-y-1 pb-4 border-b border-dashed border-gray-200 dark:border-gray-700">
                <div class="flex items-center justify-center space-x-2">
                    <i class="fa-solid fa-gem text-brand-600 text-3xl"></i>
                    <span class="text-2xl font-black tracking-tight text-gray-900 dark:text-white">SCOPALIA</span>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400">Official Payment Receipt</p>
            </div>
            
            <div class="space-y-3 py-2 text-xs">
                <div class="flex justify-between">
                    <span class="text-gray-500 dark:text-gray-400">Receipt No:</span>
                    <span class="font-mono font-bold">${payment.id.substring(0, 8).toUpperCase()}-${payment.id.substring(9, 13).toUpperCase()}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-500 dark:text-gray-400">Payment Date:</span>
                    <span class="font-semibold text-gray-800 dark:text-gray-200">${dateStr}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-500 dark:text-gray-400">Payment Method:</span>
                    <span class="font-semibold text-gray-800 dark:text-gray-200">${payment.payment_method || 'N/A'}</span>
                </div>
            </div>
            
            <div class="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg space-y-2 text-xs border border-gray-100 dark:border-gray-800">
                <div>
                    <span class="block text-xxs uppercase tracking-wider text-gray-400">Client Info</span>
                    <span class="font-semibold text-gray-850 dark:text-gray-200">${payment.profiles?.full_name || 'N/A'}</span>
                    ${payment.profiles?.company_name ? `<span class="block text-gray-500">${payment.profiles.company_name}</span>` : ''}
                </div>
                <div class="pt-1.5 border-t border-gray-200 dark:border-gray-800">
                    <span class="block text-xxs uppercase tracking-wider text-gray-400">Project</span>
                    <span class="font-semibold text-gray-850 dark:text-gray-200">${payment.projects?.name || 'N/A'}</span>
                </div>
            </div>
            
            <div class="space-y-2.5 pt-2 border-t border-dashed border-gray-200 dark:border-gray-700">
                <div class="flex justify-between text-sm">
                    <span class="text-gray-500 dark:text-gray-400">Total Project Value</span>
                    <span class="font-medium text-gray-900 dark:text-white">₹${payment.total_amount}</span>
                </div>
                
                <div class="flex justify-between items-center text-base py-1 border-y border-gray-100 dark:border-gray-800">
                    <span class="font-bold text-gray-900 dark:text-white">Amount Paid</span>
                    <span class="font-extrabold text-green-600 text-lg">₹${payment.amount_received}</span>
                </div>
                
                <div class="flex justify-between text-sm">
                    <span class="text-gray-500 dark:text-gray-400">Remaining Balance</span>
                    <span class="font-bold ${payment.remaining_amount === 0 ? 'text-green-600' : 'text-orange-500'}">
                        ₹${payment.remaining_amount}
                    </span>
                </div>
            </div>
            
            ${payment.notes ? `
                <div class="text-xxs text-gray-450 dark:text-gray-500 bg-gray-50 dark:bg-gray-900/30 p-2 rounded border border-gray-100 dark:border-gray-800 mt-2">
                    <span class="block font-semibold uppercase">Notes:</span>
                    <span class="italic">"${payment.notes}"</span>
                </div>
            ` : ''}
            
            <div class="text-center pt-4 pb-2">
                <p class="text-xxs font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-400">Thank you for your business!</p>
            </div>
        `;
        
        // Show modals
        document.getElementById('modalOverlay').classList.remove('hidden');
        document.getElementById('receiptModal').classList.remove('hidden');
        
    } catch (err) {
        console.error("Error generating receipt view:", err);
        alert("Failed to load receipt: " + (err.message || err));
    } finally {
        document.body.style.cursor = 'default';
    }
};

// Notifications Logic
async function initNotifications() {
    const bellBtn = document.getElementById('notificationBell');
    const dropdown = document.getElementById('notificationDropdown');
    const markAllReadBtn = document.getElementById('markAllReadBtn');
    
    if (!bellBtn || !dropdown) return;
    
    // Toggle dropdown
    bellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
    });
    
    // Close dropdown on click outside
    document.addEventListener('click', () => {
        dropdown.classList.add('hidden');
    });
    
    dropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', async () => {
            const { error } = await supabaseClient.from('notifications')
                .update({ is_read: true })
                .eq('user_id', currentUserId)
                .eq('is_read', false);
            if (!error) {
                loadNotifications();
            }
        });
    }
    
    // Load notifications initially
    loadNotifications();
    
    // Poll notifications every 30 seconds for live updates
    setInterval(loadNotifications, 30000);
}

async function loadNotifications() {
    const listEl = document.getElementById('notificationList');
    const badgeEl = document.getElementById('notificationBadge');
    if (!listEl) return;
    
    const { data: notifications, error } = await supabaseClient.from('notifications')
        .select('*')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false })
        .limit(20);
        
    if (error) {
        console.error("Error fetching notifications:", error);
        return;
    }
    
    const list = notifications || [];
    const unreadCount = list.filter(n => !n.is_read).length;
    
    if (unreadCount > 0) {
        badgeEl.textContent = unreadCount;
        badgeEl.classList.remove('hidden');
    } else {
        badgeEl.classList.add('hidden');
    }
    
    listEl.innerHTML = '';
    
    if (list.length === 0) {
        listEl.innerHTML = `<div class="p-4 text-center text-xs text-gray-500">No notifications yet.</div>`;
        return;
    }
    
    list.forEach(n => {
        const dateStr = new Date(n.created_at).toLocaleDateString([], { hour: '2-digit', minute: '2-digit' });
        const unreadDot = n.is_read ? '' : `<span class="h-2 w-2 bg-brand-600 rounded-full flex-shrink-0"></span>`;
        const bgClass = n.is_read ? 'hover:bg-gray-50 dark:hover:bg-gray-750' : 'bg-brand-50/30 hover:bg-brand-50/50 dark:bg-brand-950/10 dark:hover:bg-brand-950/20';
        
        const itemEl = document.createElement('div');
        itemEl.className = `p-3 flex items-start justify-between space-x-2 text-xs transition-colors cursor-pointer ${bgClass}`;
        itemEl.innerHTML = `
            <div class="space-y-0.5 min-w-0 flex-1">
                <p class="font-semibold text-gray-900 dark:text-white truncate">${n.title}</p>
                <p class="text-gray-600 dark:text-gray-400 break-words">${n.message}</p>
                <p class="text-[10px] text-gray-400 font-medium">${dateStr}</p>
            </div>
            ${unreadDot}
        `;
        
        itemEl.addEventListener('click', async () => {
            if (!n.is_read) {
                const { error: updateError } = await supabaseClient.from('notifications')
                    .update({ is_read: true })
                    .eq('id', n.id);
                if (!updateError) {
                    loadNotifications();
                }
            }
        });
        
        listEl.appendChild(itemEl);
    });
}
