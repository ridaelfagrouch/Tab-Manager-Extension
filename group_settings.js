document.addEventListener('DOMContentLoaded', function() {
    const groupsContainer = document.getElementById('groups-container');
    const addGroupBtn = document.getElementById('add-group-btn');

    function createGroupForm() {
        const formContainer = document.createElement('div');
        formContainer.className = 'form-container';
        formContainer.innerHTML = `
            <form style="width: 100%;">
                Group Name: <input type="text" name="name" required style="width: 100%"><br><br>
                Group Color: <select name="color" required style="width: 100%;height: 22px;">
                    <option>Select a color</option>
                    <option value="green">green</option>
                    <option value="red">red</option>
                    <option value="blue">blue</option>
                    <option value="pink">pink</option>
                    <option value="orange">orange</option>
                    <option value="grey">grey</option>
                    <option value="purple">purple</option>
                    <option value="yellow">yellow</option>
                    <option value="cyan">cyan</option>
                </select><br><br>
                <div class="url-container">
                    <div class="url-input">
                        URL: <input type="text" name="url" required style="width: 80%">
                        <button type="button" class="remove-url-btn">Remove</button>
                    </div>
                </div>
                <button type="button" class="add-url-btn">Add URL</button>
            </form>
        `;

        const addUrlBtn = formContainer.querySelector('.add-url-btn');
        addUrlBtn.addEventListener('click', function() {
            const urlContainer = this.previousElementSibling;
            const newUrlInput = document.createElement('div');
            newUrlInput.className = 'url-input';
            newUrlInput.innerHTML = `
                URL: <input type="text" name="url" required style="width: 80%">
                <button type="button" class="remove-url-btn">Remove</button>
            `;
            urlContainer.appendChild(newUrlInput);
        });

        formContainer.addEventListener('click', function(e) {
            if (e.target.classList.contains('remove-url-btn')) {
                e.target.parentElement.remove();
            }
        });

        groupsContainer.appendChild(formContainer);
    }

    addGroupBtn.addEventListener('click', createGroupForm);

    // Create the first group form
    createGroupForm();

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save All Groups';
    saveBtn.style.marginTop = '20px';
    document.body.appendChild(saveBtn);

    saveBtn.addEventListener('click', function() {
        const groups = [];
        document.querySelectorAll('.form-container').forEach(formContainer => {
            const form = formContainer.querySelector('form');
            const groupName = form.querySelector('input[name="name"]').value;
            const groupColor = form.querySelector('select[name="color"]').value;
            const urls = Array.from(form.querySelectorAll('input[name="url"]')).map(input => input.value);
            
            if (groupName && groupColor !== 'Select a color' && urls.length > 0) {
                groups.push({
                    name: groupName,
                    color: groupColor,
                    urls: urls
                });
            }
        });

        console.log('Saved groups:', groups);
        // Here you can add code to save the groups data to storage or send it to a server
    });
});