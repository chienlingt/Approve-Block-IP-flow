function approveBlockIP() {
    // Get current values
    var taskNumber = g_form.getValue('number');
    var ipAddress = g_form.getValue('u_ip_address_to_block');
    var ipBlocked = g_form.getValue('u_ip_blocked');
    
    // Validate: Check if IP address exists
    if (!ipAddress || ipAddress == '') {
        alert('Error: No IP address found.\n\nPlease enter an IP address in the "IP Address to Block" field.');
        return false;
    }
    
    // CHECK: Prevent duplicate blocking
    if (ipBlocked == 'true' || ipBlocked == true) {
        alert('⚠️ WARNING: This IP address is already blocked!\n\n' +
            'IP Address: ' + ipAddress + '\n\n' +
            'This IP was previously blocked and cannot be blocked again.\n' +
            'No action will be taken.');
        return false; // Stop here, don't proceed
    }
    
    // Confirm action
    var confirmMsg = 'Are you sure you want to APPROVE and block the following IP address in Salesforce?\n\n' +
                    'IP Address: ' + ipAddress + '\n' +
                    'Task: ' + taskNumber + '\n\n' +
                    'This will block the IP in Salesforce immediately.';
    
    if (!confirm(confirmMsg)) {
        return false;
    }
    
    // Show loading message
    g_form.addInfoMessage('Approving and blocking IP address ' + ipAddress + ' in Salesforce... Please wait.');
    
    // Set trigger field to true (this triggers the Business Rule)
    g_form.setValue('u_trigger_ip_block', 'true');
    
    // Save the form (triggers Business Rule)
    g_form.save();
    
    return false;
}