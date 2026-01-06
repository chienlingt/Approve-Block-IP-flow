// Business Rule Configuration:
// Name: Process Catalog Task Approval
// Table: Catalog Task [sc_task]
// When: after  ← IMPORTANT: Must be "after"
// Insert: false
// Update: true
// Filter Conditions: u_trigger_ip_block | changes
// Advanced: true

(function executeRule(current, previous) {
    
    gs.info('========================================');
    gs.info('Business Rule: Catalog Task Update Detected');
    gs.info('Task Number: ' + current.number);
    gs.info('Trigger field value: ' + current.u_trigger_ip_block);
    gs.info('Trigger changed: ' + current.u_trigger_ip_block.changes());
    
    // CHECK 1: Must be true
    if (current.u_trigger_ip_block != true && current.u_trigger_ip_block != 'true') {
        gs.info('Trigger field is not true, exiting');
        return;
    }
    
    // CHECK 2: Must have changed
    if (!current.u_trigger_ip_block.changes()) {
        gs.info('Trigger field did not change, exiting');
        return;
    }
    
    gs.info('========================================');
    gs.info('=== Processing Approved Request ===');
    gs.info('========================================');
    
    // Reset trigger immediately (AFTER checks)
    current.u_trigger_ip_block = false;
    current.update();
    gs.info('Trigger field reset to false');
    
    // Determine request type
    var ipAddress = current.u_ip_address_to_block ? current.u_ip_address_to_block.toString() : '';
    
    if (ipAddress && ipAddress != '') {
        // ROUTE 1: Block IP Address
        processBlockIPRequest(current);
    } else {
        // ROUTE 2: Permission Set
        processPermissionSetRequest(current);
    }
    
    gs.info('========================================');
    
})(current, previous);


// ============================================================================
// FUNCTION: Process Block IP Request
// ============================================================================
function processBlockIPRequest(current) {
    
    gs.info('=== BLOCK IP ADDRESS - START ===');
    
    var taskSysId = current.sys_id.toString();
    var ipAddress = current.u_ip_address_to_block.toString();
    var taskNumber = current.number.toString();
    var isAlreadyBlocked = current.u_ip_blocked;
    var justification = current.u_justification ? current.u_justification.toString() : '';
    
    gs.info('Task: ' + taskNumber);
    gs.info('IP Address: ' + ipAddress);
    gs.info('Already Blocked: ' + isAlreadyBlocked);
    gs.info('Justification: ' + justification);
    
    // Validate IP address exists
    if (!ipAddress || ipAddress == '') {
        gs.error('No IP address found');
        current.work_notes = '❌ Error: No IP address to block.';
        current.update();
        return;
    }
    
    // CHECK: Prevent duplicate blocking
    if (isAlreadyBlocked == true || isAlreadyBlocked == 'true') {
        gs.warn('IP address already blocked, skipping');
        current.work_notes = '⚠️ WARNING: IP address ' + ipAddress + ' is already blocked.\n' +
                            'This IP was previously blocked and cannot be blocked again.\n' +
                            'Timestamp: ' + new GlideDateTime().getDisplayValue();
        current.update();
        return;
    }
    
    try {
        var muleSoftEndpoint = 'https://integration-xlqlup.5sc6y6-2.usa-e2.cloudhub.io/approve-block-ip';
        
        gs.info('Endpoint: ' + muleSoftEndpoint);
        
        var request = new sn_ws.RESTMessageV2();
        request.setEndpoint(muleSoftEndpoint);
        request.setHttpMethod('POST');
        request.setRequestHeader('Content-Type', 'application/json');
        request.setRequestHeader('Accept', 'application/json');
        request.setHttpTimeout(15000);
        
        var payload = {
            ip_address: ipAddress,
            task_number: taskNumber,
            task_sys_id: taskSysId,
            justification: justification,
            reason: ''
        };
        
        var payloadString = JSON.stringify(payload);
        request.setRequestBody(payloadString);
        
        gs.info('Payload: ' + payloadString);
        gs.info('Sending request to MuleSoft...');
        
        var response = request.execute();
        var httpStatus = response.getStatusCode();
        var responseBody = response.getBody();
        
        gs.info('Response Status: ' + httpStatus);
        gs.info('Response Body: ' + responseBody);
        
        if (httpStatus == 200 || httpStatus == 201) {
            gs.info('SUCCESS - Processing response');
            
            var responseObj;
            try {
                responseObj = JSON.parse(responseBody);
                gs.info('Response parsed successfully');
            } catch (parseEx) {
                gs.error('Failed to parse response: ' + parseEx.message);
                current.work_notes = '❌ Error parsing response: ' + parseEx.message;
                current.update();
                return;
            }
            
            // Update fields
            current.u_ip_blocked = true;
            
            // Get correct state value
            var closedCompleteValue = 3;
            var gr = new GlideRecord('sys_choice');
            gr.addQuery('name', 'sc_task');
            gr.addQuery('element', 'state');
            gr.addQuery('label', 'Closed Complete');
            gr.query();
            if (gr.next()) {
                closedCompleteValue = gr.value;
            }
            
            current.state = closedCompleteValue;
            current.close_notes = 'IP address ' + ipAddress + ' approved and blocked in Salesforce. Task auto-closed.';
            
            var workNote = '✅ APPROVED: IP address ' + ipAddress + ' blocked in Salesforce successfully.\n' +
                          'Task closed automatically.\n' +
                          'Blocked at: ' + new GlideDateTime().getDisplayValue();
            
            current.work_notes = workNote;
            current.update();
            
            gs.info('=== BLOCK IP ADDRESS - SUCCESS ===');
            
        } else {
            gs.error('FAILED - HTTP Status: ' + httpStatus);
            
            current.work_notes = '❌ Failed to block IP address in Salesforce.\n' +
                                'HTTP Status: ' + httpStatus + '\n' +
                                'Response: ' + responseBody;
            current.update();
        }
        
    } catch (ex) {
        gs.error('EXCEPTION: ' + ex.message);
        gs.error('Stack Trace: ' + ex.stack);
        
        current.work_notes = '❌ Error blocking IP: ' + ex.message;
        current.update();
    }
}


// ============================================================================
// FUNCTION: Process Permission Set Request
// ============================================================================
function processPermissionSetRequest(current) {
    
    gs.info('=== PERMISSION SET REQUEST - START ===');
    
    try {
        var action = '';
        var permissionSetName = '';
        var permissionSetLabel = '';
        var requestedForEmail = '';
        var requestedForName = '';
        
        // Get from RITM if exists
        var ritm = null;
        if (!current.request_item.nil()) {
            ritm = current.request_item.getRefRecord();
        }
        
        if (ritm) {
            // Get from RITM variables
            action = ritm.variables.u_permission_set_action ? ritm.variables.u_permission_set_action.toString() : '';
            
            if (action == 'add') {
                action = 'Add Permission Set';
            } else if (action == 'remove') {
                action = 'Remove Permission Set';
            }
            
            if (ritm.variables.u_permission_set_name) {
                var psGR = new GlideRecord('u_salesforce_permission_sets');
                if (psGR.get(ritm.variables.u_permission_set_name)) {
                    permissionSetName = psGR.u_name.toString();
                    permissionSetLabel = psGR.u_label.toString();
                }
            }
        } else {
            // Get from task fields directly
            action = current.u_permission_set_action ? current.u_permission_set_action.toString() : '';
            
            if (action == 'add') {
                action = 'Add Permission Set';
            } else if (action == 'remove') {
                action = 'Remove Permission Set';
            }
            
            if (!current.u_permission_set_name.nil()) {
                var psGR = new GlideRecord('u_salesforce_permission_sets');
                if (psGR.get(current.u_permission_set_name)) {
                    permissionSetName = psGR.u_name.toString();
                    permissionSetLabel = psGR.u_label.toString();
                }
            }
        }
        
        // Get user email from u_requested_for (YOUR FIELD)
        if (!current.u_requested_for.nil()) {
            var userGR = current.u_requested_for.getRefRecord();
            requestedForEmail = userGR.email.toString();
            requestedForName = userGR.getDisplayValue();
            gs.info('Requested for: ' + requestedForName + ' (' + requestedForEmail + ')');
        }
        
        // Validate
        if (!action || !permissionSetName || !requestedForEmail) {
            var missingFields = [];
            if (!action) missingFields.push('Action');
            if (!permissionSetName) missingFields.push('Permission Set');
            if (!requestedForEmail) missingFields.push('User Email (u_requested_for)');
            
            gs.error('Missing required data: ' + missingFields.join(', '));
            
            current.work_notes = '❌ ERROR: Missing required data\n' +
                'Missing: ' + missingFields.join(', ') + '\n' +
                'Please fill all required fields:\n' +
                '- u_requested_for (Requested For)\n' +
                '- u_permission_set_action\n' +
                '- u_permission_set_name';
            current.update();
            return;
        }
        
        gs.info('Calling MuleSoft API...');
        
        current.work_notes = '⏳ Processing Permission Set Request...\n' +
            'Action: ' + action + '\n' +
            'Permission Set: ' + permissionSetLabel + '\n' +
            'User: ' + requestedForName + ' (' + requestedForEmail + ')';
        current.state = 2; // Work in Progress
        current.update();
        
        var request = new sn_ws.RESTMessageV2();
        request.setEndpoint('https://integration-xlqlup.5sc6y6-2.usa-e2.cloudhub.io/api/salesforce/permission-set/assign');
        request.setHttpMethod('POST');
        request.setRequestHeader('Content-Type', 'application/json');
        request.setHttpTimeout(15000);
        
        var requestBody = {
            action: action,
            permissionSetName: permissionSetName,
            userEmail: requestedForEmail
        };
        
        request.setRequestBody(JSON.stringify(requestBody));
        
        var response = request.execute();
        var statusCode = response.getStatusCode();
        var responseBody = response.getBody();
        
        gs.info('MuleSoft API Response - Status: ' + statusCode);
        
        var result = JSON.parse(responseBody);
        
        // Get closed complete state
        var closedCompleteValue = 3;
        var closedSkippedValue = 4; // Default to Closed Incomplete if Closed Skipped doesn't exist
        
        var grState = new GlideRecord('sys_choice');
        grState.addQuery('name', 'sc_task');
        grState.addQuery('element', 'state');
        grState.query();
        
        while (grState.next()) {
            var label = grState.label.toString();
            if (label == 'Closed Complete') {
                closedCompleteValue = grState.value;
            } else if (label == 'Closed Skipped' || label == 'Skipped') {
                closedSkippedValue = grState.value;
            }
        }
        
        gs.info('State values - Complete: ' + closedCompleteValue + ', Skipped: ' + closedSkippedValue);
        
        // Check for success
        if (statusCode == 200 && result.success) {
            
            // Check if permission set was already assigned/removed
            if (result.alreadyAssigned || result.alreadyRemoved) {
                // Close as Skipped
                current.state = closedSkippedValue;
                current.close_notes = 'Permission set already ' + 
                    (result.alreadyAssigned ? 'assigned' : 'removed') + 
                    '. No action needed.';
                
                current.work_notes = '⚠️ SKIPPED: ' + result.message + '\n\n' +
                    '=== Details ===\n' +
                    'User: ' + requestedForName + ' (' + requestedForEmail + ')\n' +
                    'Permission Set: ' + permissionSetLabel + '\n' +
                    'Action: ' + result.action + '\n' +
                    'Status: Already ' + (result.alreadyAssigned ? 'assigned' : 'removed') + '\n' +
                    'Task closed as Skipped.\n' +
                    'Processed at: ' + new GlideDateTime().getDisplayValue();
                
                gs.info('=== PERMISSION SET REQUEST - SKIPPED (Already ' + 
                    (result.alreadyAssigned ? 'Assigned' : 'Removed') + ') ===');
            } else {
                // Close as Complete
                current.state = closedCompleteValue;
                current.close_notes = 'Permission set completed successfully.';
                
                current.work_notes = '✅ SUCCESS: ' + result.message + '\n\n' +
                    '=== Details ===\n' +
                    'User: ' + requestedForName + ' (' + requestedForEmail + ')\n' +
                    'Permission Set: ' + permissionSetLabel + '\n' +
                    'Action: ' + result.action + '\n' +
                    'Assignment ID: ' + (result.assignmentId || 'N/A') + '\n' +
                    'Task closed as Complete.\n' +
                    'Completed at: ' + new GlideDateTime().getDisplayValue();
                
                gs.info('=== PERMISSION SET REQUEST - SUCCESS ===');
            }
        } else {
            current.state = 4; // Closed Incomplete
            current.work_notes = '❌ FAILED: ' + (result.message || result.error) + '\n\n' +
                'User: ' + requestedForName + '\n' +
                'Permission Set: ' + permissionSetLabel;
            
            gs.error('=== PERMISSION SET REQUEST - FAILED ===');
        }
        
        current.update();
        
    } catch (ex) {
        gs.error('EXCEPTION: ' + ex.message);
        current.work_notes = '❌ EXCEPTION: ' + ex.message;
        current.state = 4;
        current.update();
    }
}