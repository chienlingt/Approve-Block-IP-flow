// CORRECTED APPROVE FUNCTION
// Uses: u_requested_for (your new custom field)

function approveBlockIP() {
    
    var taskNumber = g_form.getValue('number');
    
    // ===========================================================================
    // AUTO-DETECT: Check if this is a Block IP request
    // ===========================================================================
    var ipAddress = g_form.getValue('u_ip_address_to_block');
    
    if (ipAddress && ipAddress != '') {
        // This is a Block IP request
        
        var ipBlocked = g_form.getValue('u_ip_blocked');
        
        // CHECK: Prevent duplicate blocking
        if (ipBlocked == 'true' || ipBlocked == true) {
            alert('⚠️ WARNING: This IP address is already blocked!\n\n' +
                  'IP Address: ' + ipAddress + '\n\n' +
                  'This IP was previously blocked and cannot be blocked again.\n' +
                  'No action will be taken.');
            return false;
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
    } 
    
    // ===========================================================================
    // AUTO-DETECT: This is a Permission Set request
    // ===========================================================================
    else {
        
        // Check for permission set fields
        var permissionSetAction = g_form.getValue('u_permission_set_action');
        var permissionSetName = g_form.getValue('u_permission_set_name');
        var requestedFor = g_form.getReference('u_requested_for'); // ← YOUR FIELD
        
        // Special handling for missing Requested For
        if (!requestedFor || !g_form.getValue('u_requested_for')) { // ← YOUR FIELD
            alert('ERROR: "Requested For" field is required!\n\n' +
                  'Please fill in the "Requested For" field before approving.\n\n' +
                  'This field specifies which user will receive the permission set.\n\n' +
                  'Steps:\n' +
                  '1. Click OK to close this dialog\n' +
                  '2. Fill in the "Requested For" field\n' +
                  '3. Click "Update" to save the task\n' +
                  '4. Then click "Approve" again');
            return false;
        }
        
        // Validate other permission set request fields
        if (!permissionSetAction || !permissionSetName) {
            var missing = [];
            if (!permissionSetAction) missing.push('Permission Set Action');
            if (!permissionSetName) missing.push('Permission Set Name');
            
            alert('Error: Missing required fields for Permission Set request.\n\n' +
                  'Missing: ' + missing.join(', ') + '\n\n' +
                  'Please fill out all required fields before approving.');
            return false;
        }
        
        var requestedForName = requestedFor.name;
        var requestedForEmail = requestedFor.email;
        
        // Validate email exists
        if (!requestedForEmail || requestedForEmail == '') {
            alert('ERROR: The selected user does not have an email address!\n\n' +
                  'User: ' + requestedForName + '\n\n' +
                  'Please select a user with a valid email address.');
            return false;
        }
        
        // Get permission set label
        var permissionSetLabel = g_form.getReference('u_permission_set_name');
        var permissionSetDisplayName = permissionSetLabel ? permissionSetLabel.u_label : 'Unknown';
        
        // Determine action text
        var actionText = (permissionSetAction == 'add') ? 'ADD' : 'REMOVE';
        var actionVerb = (permissionSetAction == 'add') ? 'to' : 'from';
        
        // Confirm action
        var confirmMsg = 'Are you sure you want to APPROVE this Permission Set request?\n\n' +
                         '=== Permission Set Request ===\n' +
                         'Action: ' + actionText + '\n' +
                         'Permission Set: ' + permissionSetDisplayName + '\n' +
                         'User: ' + requestedForName + '\n' +
                         'Email: ' + requestedForEmail + '\n' +
                         'Task: ' + taskNumber + '\n\n' +
                         'This will ' + actionText.toLowerCase() + ' the permission set ' + 
                         actionVerb + ' the user in Salesforce immediately.';
        
        if (!confirm(confirmMsg)) {
            return false;
        }
        
        // Show loading message
        g_form.addInfoMessage('Approving permission set request for ' + requestedForName + '... Please wait.');
    }
    
    // ===========================================================================
    // TRIGGER THE BUSINESS RULE (same for both types)
    // ===========================================================================
    
    // Set trigger field to true
    g_form.setValue('u_trigger_ip_block', 'true');
    
    // Save the form
    g_form.save();
    
    return false;
}