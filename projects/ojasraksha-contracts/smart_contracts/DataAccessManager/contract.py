from algopy import (
    ARC4Contract,
    Application,
    GlobalState,
    UInt64,
    Txn,
    arc4,
    op,
)

class DataAccessManager(ARC4Contract):

    def __init__(self) -> None:
        self.consent_manager_app = GlobalState(UInt64, key="cm_app")
        self.audit_app = GlobalState(UInt64, key="audit_app")
        self.queue_app = GlobalState(UInt64, key="queue_app")

    @arc4.abimethod
    def bootstrap(
        self,
        consent_manager_app_id: arc4.UInt64,
        audit_app_id: arc4.UInt64,
        queue_app_id: arc4.UInt64,
    ) -> None:
        self.consent_manager_app.value = consent_manager_app_id.native
        self.audit_app.value = audit_app_id.native
        self.queue_app.value = queue_app_id.native

    @arc4.abimethod
    def access_data(
        self,
        principal: arc4.Address,
        index: arc4.UInt64,
        scope: arc4.String,
        purpose: arc4.String,
    ) -> None:
        is_valid, _txn = arc4.abi_call[arc4.Bool](
            "validate_consent(address,uint64,string)bool",
            principal,
            index,
            scope,
            app_id=Application(self.consent_manager_app.value),
        )

        assert is_valid.native, "Invalid or expired consent"

        arc4.abi_call(
            "log_data_accessed(address,address,string,uint64,bool)void",
            principal,
            arc4.Address(Txn.sender),
            purpose,
            arc4.UInt64(op.Global.latest_timestamp),
            arc4.Bool(False),
            app_id=Application(self.audit_app.value),
        )

    @arc4.abimethod
    def emergency_access(
        self,
        principal: arc4.Address,
        request_id: arc4.UInt64,
        purpose: arc4.String,
    ) -> None:
        # Verify with QueueManager that this request is APPROVED and is EMERGENCY
        status, _txn1 = arc4.abi_call[arc4.UInt8](
            "check_status(uint64)uint8",
            request_id,
            app_id=Application(self.queue_app.value),
        )
        assert status.native == 1, "Emergency request not approved"
        
        # Log to audit 
        arc4.abi_call(
            "log_data_accessed(address,address,string,uint64,bool)void",
            principal,
            arc4.Address(Txn.sender),
            purpose,
            arc4.UInt64(op.Global.latest_timestamp),
            arc4.Bool(True),
            app_id=Application(self.audit_app.value),
        )
