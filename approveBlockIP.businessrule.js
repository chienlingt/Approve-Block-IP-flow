(function executeRule(current, previous /*null when async*/) {
    
    gs.info('========================================');
    gs.info('Business Rule: Catalog Task Update Detected');
    gs.info('Task Number: ' + current.number);
    gs.info('Trigger field value: ' + current.u_trigger_ip_block);
    
    // Check if trigger field changed to true
    if (current.u_trigger_ip_block != true) {
        gs.info('Trigger field is not true, exiting');
        return;
    }
    
    if (!current.u_trigger_ip_block.changes()) {
        gs.info('Trigger field did not change, exiting');
        return;
    }
    
    gs.info('========================================');
    gs.info('=== Approve Block IP - START ===');
    gs.info('========================================');
    
    // Get catalog task details
    var taskSysId = current.sys_id.toString();
    var ipAddress = current.u_ip_address_to_block.toString();
    var taskNumber = current.number.toString();
    var isAlreadyBlocked = current.u_ip_blocked;
	var justification = current.u_justification ? current.u_justification.toString() : '';
	gs.info('Justification: ' + justification);

    
    // // Get related Case ID from Salesforce (if exists)
    // var salesforceCaseId = current.u_salesforce_case_id ? current.u_salesforce_case_id.toString() : '';
    
    gs.info('Task: ' + taskNumber);
    gs.info('IP Address: ' + ipAddress);
    gs.info('Already Blocked: ' + isAlreadyBlocked);
    // gs.info('Salesforce Case ID: ' + salesforceCaseId);
    gs.info('Sys ID: ' + taskSysId);
    
    // Reset trigger immediately
    current.u_trigger_ip_block = false;
    gs.info('Trigger field reset to false');
    
    // Validate IP address exists
    if (!ipAddress || ipAddress == '') {
        gs.error('No IP address found');
        current.work_notes = '❌ Error: No IP address to block.';
        return;
    }
    
    // CHECK: Prevent duplicate blocking
    if (isAlreadyBlocked == true || isAlreadyBlocked == 'true') {
        gs.warn('IP address ' + ipAddress + ' is already blocked. Skipping duplicate block.');
        current.work_notes = '⚠️ WARNING: IP address ' + ipAddress + ' is already blocked.\n' +
                            'This IP was previously blocked and cannot be blocked again.\n' +
                            'Timestamp: ' + new GlideDateTime().getDisplayValue();
        
        gs.info('========================================');
        gs.info('=== Approve Block IP - SKIPPED (Already Blocked) ===');
        gs.info('========================================');
        return;
    }
    
    try {
        // MuleSoft endpoint
        var muleSoftEndpoint = 'https://integration-xlqlup.5sc6y6-2.usa-e2.cloudhub.io/approve-block-ip';
        
        gs.info('Endpoint: ' + muleSoftEndpoint);
        
        // Create REST request
        var request = new sn_ws.RESTMessageV2();
        request.setEndpoint(muleSoftEndpoint);
        request.setHttpMethod('POST');
        request.setRequestHeader('Content-Type', 'application/json');
        request.setRequestHeader('Accept', 'application/json');
        request.setHttpTimeout(15000);
        
        // Build payload with Case ID
        var payload = {
            ip_address: ipAddress,
            task_number: taskNumber,
            task_sys_id: taskSysId,
			justification: justification,
            // case_id: salesforceCaseId,
            reason: ''
        };
        
        var payloadString = JSON.stringify(payload);
        request.setRequestBody(payloadString);
        
        gs.info('Payload: ' + payloadString);
        gs.info('Sending request to MuleSoft...');
        
        // Execute request
        var response = request.execute();
        var httpStatus = response.getStatusCode();
        var responseBody = response.getBody();
        
        gs.info('Response Status: ' + httpStatus);
        gs.info('Response Body: ' + responseBody);
        
        // Process response
        if (httpStatus == 200 || httpStatus == 201) {
            gs.info('SUCCESS - Processing response');
            
            var responseObj;
            try {
                responseObj = JSON.parse(responseBody);
                gs.info('Response parsed successfully');
                gs.info('Block Visitor ID: ' + responseObj.blockVisitorId);
                gs.info('Case Closed: ' + responseObj.caseClosed);
            } catch (parseEx) {
                gs.error('Failed to parse response: ' + parseEx.message);
                current.work_notes = '❌ Error parsing response: ' + parseEx.message;
                return;
            }
            
            // Update fields
            gs.info('Setting u_ip_blocked = true');
            current.u_ip_blocked = true;
            
            // Close the Catalog Task
			gs.info('Closing Catalog Task');

			// Get the correct value for Closed Complete state
			var closedCompleteValue = 3; // Default value

			// Try to get the actual value from sys_choice
			var gr = new GlideRecord('sys_choice');
			gr.addQuery('name', 'sc_task');
			gr.addQuery('element', 'state');
			gr.addQuery('label', 'Closed Complete');
			gr.query();
			if (gr.next()) {
				closedCompleteValue = gr.value;
				gs.info('Found Closed Complete value: ' + closedCompleteValue);
			}

			current.state = closedCompleteValue;
			current.close_notes = 'IP address ' + ipAddress + ' approved and blocked in Salesforce. Task auto-closed.';

			gs.info('Task state set to: ' + current.state);
            
            gs.info('Setting work_notes');
            var workNote = '✅ APPROVED: IP address ' + ipAddress + ' blocked in Salesforce successfully.\n'; 
			// +
            //               'Block Visitor ID: ' + (responseObj.blockVisitorId || 'N/A') + '\n';
            
            // if (responseObj.caseClosed == true) {
            //     workNote += 'Salesforce Case ID ' + salesforceCaseId + ' has been closed.\n';
            // } else if (salesforceCaseId) {
            //     workNote += 'Note: Salesforce Case ' + salesforceCaseId + ' was not closed (case not found or already closed).\n';
            // }
            
            workNote += 'Task closed automatically.\n';
            workNote += 'Blocked at: ' + new GlideDateTime().getDisplayValue();
            
            current.work_notes = workNote;
            
            gs.info('Task will be closed with state: ' + current.state);
            gs.info('Fields updated successfully');
            gs.info('========================================');
            gs.info('=== Approve Block IP - SUCCESS ===');
            gs.info('========================================');
            
        } else {
            gs.error('FAILED - HTTP Status: ' + httpStatus);
            gs.error('Response: ' + responseBody);
            
            current.work_notes = '❌ Failed to block IP address in Salesforce.\n' +
                                'HTTP Status: ' + httpStatus + '\n' +
                                'Response: ' + responseBody;
            
            gs.info('========================================');
        }
        
    } catch (ex) {
        gs.error('========================================');
        gs.error('=== EXCEPTION OCCURRED ===');
        gs.error('Exception: ' + ex.message);
        gs.error('Stack Trace: ' + ex.stack);
        gs.error('========================================');
        
        current.work_notes = '❌ Error blocking IP: ' + ex.message;
    }
    
})(current, previous);