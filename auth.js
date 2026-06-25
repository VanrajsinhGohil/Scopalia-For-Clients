// js/auth.js

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const submitBtn = document.getElementById('submitBtn');
    const errorMsg = document.getElementById('errorMsg');

    // Check if user is already logged in
    checkSession();

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            submitBtn.disabled = true;
            submitBtn.textContent = 'Signing in...';
            errorMsg.classList.add('hidden');

            try {
                const { data, error } = await supabaseClient.auth.signInWithPassword({
                    email,
                    password
                });

                if (error) throw error;

                // Success! Check role and redirect
                await redirectUserBasedOnRole(data.user.id);
            } catch (error) {
                errorMsg.textContent = error.message;
                errorMsg.classList.remove('hidden');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Sign in';
            }
        });
    }

    async function checkSession() {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            // Already logged in
            await redirectUserBasedOnRole(session.user.id);
        }
    }

    async function redirectUserBasedOnRole(userId) {
        // Fetch profile to get role
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        if (error) {
            console.error("Error fetching profile role:", error);
            // If error, perhaps they don't have a profile yet due to trigger delay, default to client
            window.location.href = 'client.html';
            return;
        }

        if (data.role === 'admin') {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'client.html';
        }
    }
});
