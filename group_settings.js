document.addEventListener("DOMContentLoaded", function () {
    const groupsContainer = document.getElementById("groups-container");
    const addGroupBtn = document.getElementById("add-group-btn");
  
    function createGroupForm() {
      const formContainer = document.createElement("div");
      formContainer.className = "form-container";
      formContainer.innerHTML = `
        <form style="width: 100%;">
            <label for="Group-Name">Group Name:</label><br>
            <select class="group-name-select" name="name" required style="width: 100%;height: 30px;">
                <option>Select Group Name</option>
                <option value="search">Search</option>
                <option value="social">Social</option>
                <option value="news">News</option>
                <option value="shopping">Shopping</option>
                <option value="entertainment">Entertainment</option>
                <option value="work">Work</option>
                <option value="education">Education</option>
                <option value="health">Health</option>
                <option value="finance">Finance</option>
                <option value="sports">Sports</option>
                <option value="travel">Travel</option>
                <option value="food">Food</option>
                <option value="development">Development</option>
                <option value="other">Other</option>
            </select>
            <div class="error-message" id="group-name-error"></div>
            <input type="text" class="custom-group-name" name="custom-name" placeholder="Enter custom group name" style="width: 98%; margin-bottom: -10px; height: 23px; display: none;"><br><br>
            <label for="Group-Color">Group Color:</label><br>
            <select name="color" required style="width: 100%;height: 30px;">
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
            </select>
            <div class="error-message" id="group-color-error"></div><br><br>
            <div class="url-container">
                <label for="URL">URL:</label><br>
                <div class="url-input">
                    <input type="text" name="url" required style="width: 98%; height: 23px;">
                    <div class="error-message"></div>
                </div>
            </div>
            <button type="button" class="add-url-btn">Add URL</button>
        </form>
      `;
  
      if (groupsContainer.children.length > 0) {
        const removeGroupBtn = document.createElement("button");
        removeGroupBtn.type = "button";
        removeGroupBtn.className = "remove-group-btn";
        removeGroupBtn.textContent = "Remove Group";
        removeGroupBtn.style.marginTop = "10px";
        formContainer.appendChild(removeGroupBtn);
      }
  
      const addUrlBtn = formContainer.querySelector(".add-url-btn");
      addUrlBtn.addEventListener("click", function () {
        const urlContainer = this.previousElementSibling;
        const newUrlInput = document.createElement("div");
        newUrlInput.className = "url-input";
        newUrlInput.innerHTML = `
            <input type="text" name="url" required style="width: 98%; height: 23px;">
            <div class="error-message"></div>
            <button type="button" class="remove-url-btn" style="align-self: flex-end;">Remove</button>
        `;
        urlContainer.appendChild(newUrlInput);
      });
  
      formContainer.addEventListener("click", function (e) {
        if (e.target.classList.contains("remove-url-btn")) {
          e.target.parentElement.remove();
        } else if (e.target.classList.contains("remove-group-btn")) {
          if (groupsContainer.children.length > 1 || groupsContainer.children[0] !== formContainer) {
            formContainer.remove();
          } else {
            alert("The first group cannot be removed.");
          }
        }
      });
  
      const groupNameSelect = formContainer.querySelector(".group-name-select");
      const customGroupNameInput = formContainer.querySelector(".custom-group-name");
      groupNameSelect.addEventListener("change", function () {
        customGroupNameInput.style.display = groupNameSelect.value === "other" ? "block" : "none";
      });
  
      groupsContainer.appendChild(formContainer);
    }
  
    addGroupBtn.addEventListener("click", createGroupForm);
  
    // Create the first group form
    createGroupForm();
  
    const saveBtn = document.createElement("button");
    saveBtn.textContent = "Save All Groups";
    document.getElementById("button-groups-container").appendChild(saveBtn);
  
    saveBtn.addEventListener("click", function () {
        const groups = [];
        let isValid = true;
      
        document.querySelectorAll(".form-container").forEach((formContainer) => {
          const form = formContainer.querySelector("form");
          const groupNameSelect = form.querySelector(".group-name-select");
          const groupNameError = form.querySelector("#group-name-error");
          const groupName = groupNameSelect.value === "other"
            ? form.querySelector(".custom-group-name").value
            : groupNameSelect.value;
          const groupColorSelect = form.querySelector('select[name="color"]');
          const groupColorError = form.querySelector("#group-color-error");
          const groupColor = groupColorSelect.value;
          const urls = Array.from(form.querySelectorAll('input[name="url"]')).map((input) => {
            const urlError = input.nextElementSibling;
            urlError.textContent = "";

            console.log("input.value url: ", input.value);
      
            // Check if the URL is valid
            const urlPattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
            '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
            '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
            '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
            '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
            '(\\#[-a-z\\d_]*)?$','i'); // fragment locator
      
            // Extract domain name for simplification
            let simplifiedUrl = "";
            if (urlPattern.test(input.value)) {
              const url = new URL(input.value);
                simplifiedUrl = `/${url.hostname.replace('www.', '')}/`;
                simplifiedUrl = simplifiedUrl.replace(/\./g, '\\.');
            } else {
              urlError.textContent = "Please enter a valid URL.";
              isValid = false;
            }
      
            return simplifiedUrl;
          });
      
          if (!groupName || groupName === "Select Group Name") {
            groupNameError.textContent = "Please select or enter a group name.";
            isValid = false;
          } else {
            groupNameError.textContent = "";
          }
      
          if (!groupColor || groupColor === "Select a color") {
            groupColorError.textContent = "Please select a color.";
            isValid = false;
          } else {
            groupColorError.textContent = "";
          }
      
          const groupNames = groups.map((group) => group.name);
          if (groupNames.includes(groupName)) {
            alert("Group names must be unique");
            isValid = false;
            return;
          }
      
          if (isValid) {
            groups.push({
              name: groupName,
              color: groupColor,
              urls: urls,
            });
          }
        });
      
        if (isValid) {
          chrome.runtime.sendMessage(
            { action: "saveGroupConfigs", groupConfigs: groups },
            (response) => {
              if (response.status === "success") {
                console.log("Group configurations saved successfully");
                renderSavedGroups();
              } else {
                console.error("Failed to save group configurations");
              }
            }
          );
        } else {
          console.error("Form validation failed. Please correct the errors and try again.");
        }
      });
      
      
  
    function renderSavedGroups() {
      const savedGroupsContainer = document.getElementById("saved-groups");
      console.log("Saved groups container:", savedGroupsContainer);
      if (!savedGroupsContainer) {
        console.error("Could not find the saved-groups container");
        return;
      }
  
      chrome.runtime.sendMessage({ action: "getGroupConfigs" }, (response) => {
        let groupConfigs = response.groupConfigs || [];
      
        // Remove deplicated group urls
        groupConfigs.forEach((group) => {
          group.urls = Array.from(new Set(group.urls));
        });
  
        groupConfigs = groupConfigs.filter((group) => group.name !== "Others");

        groupConfigs.forEach((group) => {
            console.log('------------------------------------------')
            group.urls.forEach((url, index) => {
                console.log(`URL ${index + 1}: ${JSON.stringify(url, null, 2)}`);
            }
            );
            console.log('------------------------------------------')
        }
        );

  
        if (groupConfigs.length === 0) {
          savedGroupsContainer.innerHTML = `
            <div style="display: flex; align-items: center; justify-content:center">
            <p>No groups saved</p>
            </div>`;
        } else {
          console.log("Saved groups:", groupConfigs);
          savedGroupsContainer.innerHTML = `
            ${groupConfigs
              .map(
                (group, index) => `
                    <div>
                        <h3>Group ${index + 1}</h3>
                        <div class="saved-group" style="padding: 20px;">
                            <h4>Group Name: ${group.name}</h4>
                            <h4>Color: ${group.color}</h4>
                            <h4>URLs:</h4>
                            <ul>
                                ${group.urls
                                  .map((url) => `<li>${url}</li>`)
                                  .join("")}
                            </ul>
                        </div>
                        <hr style="background-color: black; height: 2px;">
                    </div>
                    `
              )
              .join("")}
            `;
        }
      });
    }
  
    renderSavedGroups();
  });
  