from algopy import (
    ARC4Contract,
    GlobalState,
    BoxMap,
    UInt64,
    Txn,
    arc4,
    op,
    urange
)

class QueueRequest(arc4.Struct):
    id: arc4.UInt64
    requester: arc4.Address
    target: arc4.Address
    purpose: arc4.String
    request_type: arc4.UInt8 # 1=Normal, 2=Emergency
    timestamp: arc4.UInt64
    status: arc4.UInt8 # 0=Pending, 1=Approved, 2=Rejected, 3=Expired

class QueueManager(ARC4Contract):

    def __init__(self) -> None:
        self.request_counter = GlobalState(UInt64, key="req_counter")
        self.request_counter.value = UInt64(0)
        
        # Admin for emergency overrides overrides
        self.admin = GlobalState(arc4.Address, key="admin")
        self.admin.value = arc4.Address("ZB4FKAVJU6E3ANTCSPPA5PSSIA35XUUA4O2GASDKZVDLUNZ4DMPLYJMVKM")

        # BoxMap for quick lookup by ID, we maintain two lists per patient: normal and emergency
        self.requests = BoxMap(arc4.UInt64, QueueRequest, key_prefix=b"req_")
        
        # Index lists arrays for a patient: patient address -> array of request IDs
        self.patient_requests = BoxMap(arc4.Address, arc4.DynamicArray[arc4.UInt64], key_prefix=b"prq_")

    @arc4.abimethod
    def submit_request(
        self,
        target: arc4.Address,
        purpose: arc4.String,
        is_emergency: arc4.Bool,
    ) -> arc4.UInt64:
        """Submit a new access request."""
        self.request_counter.value += UInt64(1)
        req_id = arc4.UInt64(self.request_counter.value)
        
        req_type = arc4.UInt8(2) if is_emergency.native else arc4.UInt8(1)
        now = op.Global.latest_timestamp
        
        new_req = QueueRequest(
            id=req_id,
            requester=arc4.Address(Txn.sender),
            target=target,
            purpose=purpose,
            request_type=req_type,
            timestamp=arc4.UInt64(now),
            status=arc4.UInt8(0) # Pending
        )
        
        self.requests[req_id] = new_req.copy()
        
        if target in self.patient_requests:
            arr = self.patient_requests[target].copy()
            arr.append(req_id)
            self.patient_requests[target] = arr.copy()
        else:
            arr = arc4.DynamicArray[arc4.UInt64](req_id)
            self.patient_requests[target] = arr.copy()
            
        arc4.emit("RequestSubmitted(uint64,address,address,uint8)", req_id, arc4.Address(Txn.sender), target, req_type)
        return req_id

    @arc4.abimethod
    def approve_request(self, request_id: arc4.UInt64) -> None:
        """Patient approves their own request, or Admin approves an emergency one."""
        req = self.requests[request_id].copy()
        assert req.status == arc4.UInt8(0), "Request not pending"

        caller = arc4.Address(Txn.sender)
        is_owner = caller == req.target
        is_admin = caller == self.admin.value

        if req.request_type == arc4.UInt8(2): # Emergency
            assert is_admin or is_owner, "Only admin or target can override emergency"
        else:
            assert is_owner, "Only target patient can approve"

        req.status = arc4.UInt8(1) # Approved
        self.requests[request_id] = req.copy()
        arc4.emit("RequestApproved(uint64,address)", request_id, caller)

    @arc4.abimethod
    def reject_request(self, request_id: arc4.UInt64) -> None:
        """Patient rejects their own request, or Admin rejects an emergency one."""
        req = self.requests[request_id].copy()
        assert req.status == arc4.UInt8(0), "Request not pending"

        caller = arc4.Address(Txn.sender)
        is_owner = caller == req.target
        is_admin = caller == self.admin.value

        if req.request_type == arc4.UInt8(2): # Emergency
            assert is_admin or is_owner, "Only admin or target can override emergency"
        else:
            assert is_owner, "Only target patient can reject"

        req.status = arc4.UInt8(2) # Rejected
        self.requests[request_id] = req.copy()
        arc4.emit("RequestRejected(uint64,address)", request_id, caller)

    @arc4.abimethod(readonly=True)
    def check_status(self, request_id: arc4.UInt64) -> arc4.UInt8:
        """Helper to quickly check queue status."""
        assert request_id in self.requests, "Request not found"
        req = self.requests[request_id].copy()
        # Basic expiration logic (e.g. 24h) can be checked lazily
        # Here we just return status directly.
        return req.status

    @arc4.abimethod(readonly=True)
    def get_patient_queue(self, patient: arc4.Address) -> arc4.DynamicArray[QueueRequest]:
        """Returns the pending list, with Emergency requests first."""
        ret = arc4.DynamicArray[QueueRequest]()
        if patient in self.patient_requests:
            arr = self.patient_requests[patient].copy()
            # Pass 1: Emergency pending
            for i in urange(arr.length):
                req_id = arr[i]
                req = self.requests[req_id].copy()
                if req.status == arc4.UInt8(0) and req.request_type == arc4.UInt8(2):
                    ret.append(req.copy())
            # Pass 2: Normal pending
            for i in urange(arr.length):
                req_id = arr[i]
                req = self.requests[req_id].copy()
                if req.status == arc4.UInt8(0) and req.request_type == arc4.UInt8(1):
                    ret.append(req.copy())
        return ret.copy()

    @arc4.abimethod(readonly=True)
    def get_request(self, request_id: arc4.UInt64) -> QueueRequest:
        assert request_id in self.requests, "Not found"
        return self.requests[request_id].copy()
