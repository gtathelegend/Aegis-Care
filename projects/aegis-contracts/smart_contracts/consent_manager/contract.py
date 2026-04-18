from algopy import (
    ARC4Contract,
    GlobalState,
    LocalState,
    BoxMap,
    UInt64,
    Bytes,
    Account,
    Txn,
    arc4,
    subroutine,
    String,
    urange
)
import typing


# --- Structs ---

class Consent(arc4.Struct):
    data_principal: arc4.Address
    data_fiduciary: arc4.Address
    purpose: arc4.String
    data_hash: arc4.String
    data_scope: arc4.String
    granted_at: arc4.UInt64
    expiry: arc4.UInt64
    is_active: arc4.Bool
    erased: arc4.Bool


class AccessRequest(arc4.Struct):
    id: arc4.UInt64
    provider: arc4.Address
    purpose: arc4.String
    timestamp: arc4.UInt64
    is_pending: arc4.Bool


# --- Contract ---

class ConsentManager(ARC4Contract):

    def __init__(self) -> None:
        self.request_counter = GlobalState(UInt64, key="req_counter")
        # BoxMap: key = (patient_address + index bytes), value = Consent
        self.consents = BoxMap(arc4.Address, arc4.DynamicArray[Consent], key_prefix=b"c_")
        # BoxMap: key = patient_address, value = DynamicArray of AccessRequest
        self.access_requests = BoxMap(arc4.Address, arc4.DynamicArray[AccessRequest], key_prefix=b"ar_")
        self.request_counter.value = UInt64(0)

    @arc4.abimethod
    def grant_consent(
        self,
        fiduciary: arc4.Address,
        purpose: arc4.String,
        data_hash: arc4.String,
        data_scope: arc4.String,
        duration_in_seconds: arc4.UInt64,
    ) -> None:
        from algopy import op

        sender_addr = arc4.Address(Txn.sender)
        now = op.Global.latest_timestamp
        expiry = now + duration_in_seconds.native

        new_consent = Consent(
            data_principal=sender_addr,
            data_fiduciary=fiduciary,
            purpose=purpose,
            data_hash=data_hash,
            data_scope=data_scope,
            granted_at=arc4.UInt64(now),
            expiry=arc4.UInt64(expiry),
            is_active=arc4.Bool(True),
            erased=arc4.Bool(False),
        )

        if sender_addr in self.consents:
            arr = self.consents[sender_addr].copy()
            arr.append(new_consent.copy())
            self.consents[sender_addr] = arr.copy()
        else:
            arr = arc4.DynamicArray[Consent](new_consent.copy())
            self.consents[sender_addr] = arr.copy()

    @arc4.abimethod
    def revoke_consent(self, index: arc4.UInt64) -> None:
        sender_addr = arc4.Address(Txn.sender)
        arr = self.consents[sender_addr].copy()
        consent = arr[index.native].copy()
        assert consent.is_active.native, "Already revoked"
        consent.is_active = arc4.Bool(False)
        arr[index.native] = consent.copy()
        self.consents[sender_addr] = arr.copy()

    @arc4.abimethod
    def request_erasure(self, index: arc4.UInt64) -> None:
        sender_addr = arc4.Address(Txn.sender)
        arr = self.consents[sender_addr].copy()
        consent = arr[index.native].copy()
        consent.erased = arc4.Bool(True)
        consent.is_active = arc4.Bool(False)
        consent.purpose = arc4.String("ERASED")
        consent.data_hash = arc4.String("ERASED")
        consent.data_scope = arc4.String("ERASED")
        arr[index.native] = consent.copy()
        self.consents[sender_addr] = arr.copy()

    @arc4.abimethod(readonly=True)
    def get_patient_consents(
        self, patient: arc4.Address
    ) -> arc4.DynamicArray[Consent]:
        return self.consents[patient].copy()

    @arc4.abimethod(readonly=True)
    def validate_consent(
        self,
        principal: arc4.Address,
        index: arc4.UInt64,
        required_scope: arc4.String,
    ) -> arc4.Bool:
        from algopy import op

        arr = self.consents[principal].copy()
        consent = arr[index.native].copy()
        now = op.Global.latest_timestamp

        if (
            consent.is_active.native
            and not consent.erased.native
            and now <= consent.expiry.native
        ):
            if consent.data_scope == arc4.String("All"):
                return arc4.Bool(True)
            if consent.data_scope == required_scope:
                return arc4.Bool(True)

        return arc4.Bool(False)

    @arc4.abimethod
    def update_consent_duration(
        self, index: arc4.UInt64, new_duration_in_seconds: arc4.UInt64
    ) -> None:
        from algopy import op

        sender_addr = arc4.Address(Txn.sender)
        arr = self.consents[sender_addr].copy()
        consent = arr[index.native].copy()
        assert consent.is_active.native, "Consent not active"
        now = op.Global.latest_timestamp
        consent.expiry = arc4.UInt64(now + new_duration_in_seconds.native)
        arr[index.native] = consent.copy()
        self.consents[sender_addr] = arr.copy()

    @arc4.abimethod
    def request_access(
        self, patient: arc4.Address, purpose: arc4.String
    ) -> None:
        from algopy import op

        self.request_counter.value += UInt64(1)
        new_request = AccessRequest(
            id=arc4.UInt64(self.request_counter.value),
            provider=arc4.Address(Txn.sender),
            purpose=purpose,
            timestamp=arc4.UInt64(op.Global.latest_timestamp),
            is_pending=arc4.Bool(True),
        )

        if patient in self.access_requests:
            arr = self.access_requests[patient].copy()
            arr.append(new_request.copy())
            self.access_requests[patient] = arr.copy()
        else:
            arr = arc4.DynamicArray[AccessRequest](new_request.copy())
            self.access_requests[patient] = arr.copy()

    @arc4.abimethod(readonly=True)
    def get_pending_requests(
        self, patient: arc4.Address
    ) -> arc4.DynamicArray[AccessRequest]:
        pending = arc4.DynamicArray[AccessRequest]()
        if patient in self.access_requests:
            arr = self.access_requests[patient].copy()
            for i in urange(arr.length):
                req = arr[i].copy()
                if req.is_pending.native:
                    pending.append(req.copy())
        return pending.copy()

    @arc4.abimethod
    def approve_request(
        self,
        request_id: arc4.UInt64,
        data_hash: arc4.String,
        data_scope: arc4.String,
        duration_in_seconds: arc4.UInt64,
    ) -> None:
        from algopy import op

        sender_addr = arc4.Address(Txn.sender)
        arr = self.access_requests[sender_addr].copy()
        found = arc4.Bool(False)
        found_idx = UInt64(0)

        for i in urange(arr.length):
            req = arr[i].copy()
            if req.id == request_id and req.is_pending.native:
                found = arc4.Bool(True)
                found_idx = i
                break

        assert found.native, "Pending request not found"

        req = arr[found_idx].copy()
        req.is_pending = arc4.Bool(False)
        arr[found_idx] = req.copy()
        self.access_requests[sender_addr] = arr.copy()

        now = op.Global.latest_timestamp
        expiry = now + duration_in_seconds.native

        new_consent = Consent(
            data_principal=sender_addr,
            data_fiduciary=req.provider,
            purpose=req.purpose,
            data_hash=data_hash,
            data_scope=data_scope,
            granted_at=arc4.UInt64(now),
            expiry=arc4.UInt64(expiry),
            is_active=arc4.Bool(True),
            erased=arc4.Bool(False),
        )

        if sender_addr in self.consents:
            c_arr = self.consents[sender_addr].copy()
            c_arr.append(new_consent.copy())
            self.consents[sender_addr] = c_arr.copy()
        else:
            c_arr = arc4.DynamicArray[Consent](new_consent.copy())
            self.consents[sender_addr] = c_arr.copy()

    @arc4.abimethod
    def reject_request(self, request_id: arc4.UInt64) -> None:
        sender_addr = arc4.Address(Txn.sender)
        arr = self.access_requests[sender_addr].copy()
        for i in urange(arr.length):
            req = arr[i].copy()
            if req.id == request_id and req.is_pending.native:
                req.is_pending = arc4.Bool(False)
                arr[i] = req.copy()
                break
        self.access_requests[sender_addr] = arr.copy()
