// Scheduled Job Script to Sync Salesforce Permission Sets
// Run this daily or as needed

(function() {
    try {
        gs.info('Starting Salesforce Permission Sets sync...');
        
        // MuleSoft API endpoint
        var endpoint = 'https://your-mulesoft-domain.cloudhub.io/api/salesforce/permission-sets';
        
        // Create REST Message
        var request = new sn_ws.RESTMessageV2();
        request.setEndpoint(endpoint);
        request.setHttpMethod('GET');
        
        // Add authentication if needed
        // request.setBasicAuth('username', 'password');
        // OR
        // request.setRequestHeader('Authorization', 'Bearer YOUR_TOKEN');
        
        request.setRequestHeader('Content-Type', 'application/json');
        request.setRequestHeader('Accept', 'application/json');
        
        // Execute request
        var response = request.execute();
        var httpStatus = response.getStatusCode();
        var responseBody = response.getBody();
        
        gs.info('API Response Status: ' + httpStatus);
        
        if (httpStatus == 200) {
            var jsonResponse = JSON.parse(responseBody);
            
            if (jsonResponse.success) {
                var permissionSets = jsonResponse.permission_sets;
                var syncCount = 0;
                var errorCount = 0;
                
                // Clear existing records (optional - or update existing)
                var grDelete = new GlideRecord('u_salesforce_permission_sets');
                grDelete.deleteMultiple();
                
                // Insert new permission sets
                for (var i = 0; i < permissionSets.length; i++) {
                    try {
                        var ps = permissionSets[i];
                        var gr = new GlideRecord('u_salesforce_permission_sets');
                        gr.initialize();
                        gr.u_name = ps.value;
                        gr.u_label = ps.label;
                        gr.u_description = ps.description || '';
                        gr.u_salesforce_id = ps.id;
                        gr.u_active = true;
                        gr.insert();
                        syncCount++;
                    } catch (e) {
                        gs.error('Error inserting permission set: ' + e.message);
                        errorCount++;
                    }
                }
                
                gs.info('Permission Sets sync completed. Synced: ' + syncCount + ', Errors: ' + errorCount);
                return 'SUCCESS: Synced ' + syncCount + ' permission sets';
            } else {
                gs.error('API returned success=false: ' + jsonResponse.error);
                return 'FAILED: ' + jsonResponse.error;
            }
        } else {
            gs.error('API call failed with status: ' + httpStatus + ', Response: ' + responseBody);
            return 'FAILED: HTTP ' + httpStatus;
        }
        
    } catch (ex) {
        gs.error('Exception in Permission Sets sync: ' + ex.message);
        return 'FAILED: ' + ex.message;
    }
})();