// Script Include Name: SalesforcePermissionSetUtils
// Type: Script Include
// Client callable: true (if needed from client side)

var SalesforcePermissionSetUtils = Class.create();
SalesforcePermissionSetUtils.prototype = {
    initialize: function() {
    },
    
    /**
     * Get all active permission sets from the sync table
     * Returns array of objects with value and label
     */
    getPermissionSets: function() {
        var permissionSets = [];
        
        var gr = new GlideRecord('u_salesforce_permission_sets');
        gr.addActiveQuery();
        gr.orderBy('u_label');
        gr.query();
        
        while (gr.next()) {
            permissionSets.push({
                value: gr.getValue('u_name'),
                label: gr.getValue('u_label'),
                description: gr.getValue('u_description')
            });
        }
        
        return permissionSets;
    },
    
    /**
     * Get permission set details by name
     */
    getPermissionSetByName: function(name) {
        var gr = new GlideRecord('u_salesforce_permission_sets');
        gr.addQuery('u_name', name);
        gr.addActiveQuery();
        gr.query();
        
        if (gr.next()) {
            return {
                name: gr.getValue('u_name'),
                label: gr.getValue('u_label'),
                description: gr.getValue('u_description'),
                salesforce_id: gr.getValue('u_salesforce_id')
            };
        }
        
        return null;
    },
    
    /**
     * Validate permission set exists
     */
    isValidPermissionSet: function(name) {
        var gr = new GlideRecord('u_salesforce_permission_sets');
        gr.addQuery('u_name', name);
        gr.addActiveQuery();
        gr.query();
        
        return gr.hasNext();
    },
    
    type: 'SalesforcePermissionSetUtils'
};