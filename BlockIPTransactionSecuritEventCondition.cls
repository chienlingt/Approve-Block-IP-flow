public class BlockIPTransactionSecuritEventCondition implements TxnSecurity.EventCondition {
    
    /**
     * Evaluates whether a login attempt should be blocked based on IP address
     * @param event The login event (SObject) containing user and IP information
     * @return Boolean - true to block, false to allow
     */
    public Boolean evaluate(SObject event) {
        
        try {
            // Cast the event to a map to access fields
            Map<String, Object> eventData = (Map<String, Object>) JSON.deserializeUntyped(
                JSON.serialize(event)
            );
            
            // Get the login IP from the event
            // Try multiple possible field names
            String loginIP = null;
            
            if (eventData.containsKey('SourceIp')) {
                loginIP = (String) eventData.get('SourceIp');
            } else if (eventData.containsKey('LoginIp')) {
                loginIP = (String) eventData.get('LoginIp');
            } else if (eventData.containsKey('ClientIp')) {
                loginIP = (String) eventData.get('ClientIp');
            }
            
            // Log for debugging
            System.debug('Evaluating login from IP: ' + loginIP);
            System.debug('Event data: ' + eventData);
            
            // If no IP, allow the login
            if (String.isBlank(loginIP)) {
                System.debug('No IP address found, allowing login');
                return false; // false = don't block
            }
            
            // Query Block_visitor__c to check if IP is blocked
            List<Block_visitor__c> blockedRecords = [
                SELECT Id, Name, From_IP_Address__c, To_IP_Address__c, 
                       Description__c, Is_Active__c
                FROM Block_visitor__c
                WHERE Is_Active__c = true
                AND (
                    From_IP_Address__c = :loginIP
                    OR (
                        From_IP_Address__c <= :loginIP 
                        AND To_IP_Address__c >= :loginIP
                    )
                )
                LIMIT 1
            ];
            
            // If IP is in block list, block the login
            if (!blockedRecords.isEmpty()) {
                System.debug('IP ' + loginIP + ' is BLOCKED - Record: ' + blockedRecords[0].Name);
                return true; // true = block the login
            } else {
                System.debug('IP ' + loginIP + ' is not blocked, allowing login');
                return false; // false = don't block
            }
            
        } catch (Exception e) {
            // On error, allow login and log the error
            System.debug('Error in BlockIPTransactionSecuritEventCondition: ' + e.getMessage());
            System.debug('Stack trace: ' + e.getStackTraceString());
            return false; // false = don't block (fail open for safety)
        }
    }
}