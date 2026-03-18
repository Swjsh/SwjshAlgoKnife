# Broker Error Recovery - Implementation Summary

## Problem
When users entered invalid broker API credentials, the broker config would be saved with `FAILED` status but there was no clear way to retry or fix the issue. Users were stuck with failed broker configs in their account.

## Solution
Implemented automatic cleanup and clear retry paths for failed broker connections.

---

## Changes Made

### 1. Onboarding Broker Page (`src/app/onboarding/broker/page.tsx`)

**Before:**
- Failed verification left broker config in FAILED state
- User saw error but had to navigate away and back
- Failed config persisted in database

**After:**
- Failed broker config automatically deleted on verification failure
- User stays on page with form filled out
- Clear error message with retry instructions
- User can correct credentials and try again immediately

```typescript
if (!verifyRes.ok) {
  // Delete the failed broker config
  await fetch(`/api/brokers/${savedBroker.id}`, {
    method: 'DELETE',
  });

  // Show detailed error
  let errorMsg = data.error || 'Failed to verify broker connection';
  if (data.details) {
    errorMsg += '\n\n' + data.details;
  }
  errorMsg += '\n\nPlease check your credentials and try again.';

  throw new Error(errorMsg);
}
```

### 2. Brokers Management Page (`src/app/brokers/page.tsx`)

**Added Modal Error Recovery:**
- Same auto-delete behavior when adding new broker
- Modal stays open on failure
- Error message with details shown
- User can correct and retry without closing modal

**Added Failed Broker Actions:**
- "Retry Connection" button for failed brokers (green)
- "Delete & Retry" button to remove and start fresh (red)
- Different UI state for failed vs connected brokers

```typescript
{broker.connectionStatus === 'FAILED' ? (
  <>
    <button onClick={() => handleVerifyBroker(broker.id)}>
      Retry Connection
    </button>
    <button onClick={() => handleDeleteBroker(broker.id)}>
      Delete & Retry
    </button>
  </>
) : (
  // Normal actions for connected brokers
)}
```

---

## User Experience Flow

### Scenario 1: Invalid Credentials During Onboarding

1. **User enters fake credentials:**
   ```
   API Key: PKfakekey123
   Secret Key: fakesecret456
   ```

2. **System behavior:**
   - Creates broker config
   - Attempts verification
   - Verification fails with 401 Unauthorized
   - **Automatically deletes the failed config**
   - Shows error: "Invalid API key or secret. Please verify your credentials. Please check your credentials and try again."

3. **User experience:**
   - Stays on broker setup page
   - Form still has their input
   - Can fix credentials immediately
   - Clicks "Connect & Verify" again
   - Clean slate - no failed configs lingering

### Scenario 2: Invalid Credentials on Brokers Page

1. **User clicks "Add Broker"**
2. **Enters invalid credentials**
3. **System behavior:**
   - Same auto-delete on failure
   - Modal stays open
   - Error displayed in modal

4. **User experience:**
   - Sees error message
   - Modal still open
   - Can correct credentials
   - Clicks "Connect Broker" again
   - Clean retry

### Scenario 3: Existing Failed Broker (Edge Case)

If somehow a failed broker exists (from old code or manual DB edit):

1. **User sees broker with "DISCONNECTED" or "FAILED" status**
2. **Error message displayed** showing what went wrong
3. **Two options:**
   - Click "Retry Connection" - re-verifies with existing credentials
   - Click "Delete & Retry" - removes broker to start fresh

---

## Technical Details

### Auto-Delete on Failure
Failed broker configs are automatically deleted to prevent accumulation of bad data:

```typescript
// In both onboarding and brokers pages
if (!verifyRes.ok) {
  await fetch(`/api/brokers/${broker.id}`, {
    method: 'DELETE',
  });
  // Show error and let user retry
}
```

### Error Message Enhancement
Detailed error messages help users understand what went wrong:

- **401 Unauthorized:** "Invalid API key or secret. Please verify your credentials."
- **403 Forbidden:** "Check that your API keys have trading permissions enabled in Alpaca dashboard"
- **Generic:** Full error details from API response

### UI State Management
- Verification loading state: "Verifying..." or "Retrying..."
- Failed broker actions are visually distinct (green retry, red delete)
- Normal broker actions for connected brokers

---

## Testing

### Test Case 1: Invalid Credentials During Onboarding
```
Steps:
1. Go through signup flow
2. Reach broker connection page
3. Enter invalid credentials:
   - API Key: PKfake123
   - Secret Key: fakesecret456
4. Click "Connect & Verify"

Expected:
- Error message appears
- Form stays filled
- Can immediately retry
- No failed broker in database
```

### Test Case 2: Invalid Credentials on Brokers Page
```
Steps:
1. Navigate to /brokers
2. Click "Add Broker"
3. Enter invalid credentials
4. Click "Connect Broker"

Expected:
- Modal stays open
- Error shown in modal
- Can retry without closing
- No failed broker saved
```

### Test Case 3: Valid Credentials After Failed Attempt
```
Steps:
1. Try with invalid credentials (fails)
2. Correct the credentials
3. Click verify again

Expected:
- Second attempt succeeds
- Broker saved with CONNECTED status
- Account info fetched
- User can proceed
```

---

## Database Impact

**Before Fix:**
```sql
-- Failed brokers accumulated
SELECT * FROM "BrokerConfig" WHERE "connectionStatus" = 'FAILED';
-- Multiple failed attempts visible
```

**After Fix:**
```sql
-- Failed brokers automatically cleaned up
SELECT * FROM "BrokerConfig" WHERE "connectionStatus" = 'FAILED';
-- Should be empty or minimal
```

---

## Summary

✅ **Fixed:** Failed broker configs no longer accumulate
✅ **Fixed:** Clear retry path for invalid credentials
✅ **Fixed:** User stays in context when error occurs
✅ **Fixed:** Detailed error messages guide troubleshooting

The broker error recovery is now **tight and clean** - users get immediate feedback, can retry without navigating away, and don't end up with orphaned failed configs in their account.
