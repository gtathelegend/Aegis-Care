from algopy import ARC4Contract, arc4
from algopy.arc4 import Address, String, UInt64, Bool


# ARC-28 Event Structs
class ConsentGranted(arc4.Struct):
    data_principal: Address
    fiduciary: Address
    purpose: String
    expiry: UInt64
    scopes: String


class ConsentRevoked(arc4.Struct):
    data_principal: Address
    fiduciary: Address
    timestamp: UInt64


class DataAccessed(arc4.Struct):
    data_principal: Address
    fiduciary: Address
    purpose: String
    timestamp: UInt64
    is_emergency: Bool


class AccessRequested(arc4.Struct):
    data_principal: Address
    fiduciary: Address
    purpose: String
    timestamp: UInt64


class ErasureRequested(arc4.Struct):
    data_principal: Address
    timestamp: UInt64


class AuditLog(ARC4Contract):

    @arc4.abimethod
    def log_consent_granted(
        self,
        principal: Address,
        fiduciary: Address,
        purpose: String,
        expiry: UInt64,
        scopes: String,
    ) -> None:
        arc4.emit(ConsentGranted(principal, fiduciary, purpose, expiry, scopes))

    @arc4.abimethod
    def log_consent_revoked(
        self,
        principal: Address,
        fiduciary: Address,
        timestamp: UInt64,
    ) -> None:
        arc4.emit(ConsentRevoked(principal, fiduciary, timestamp))

    @arc4.abimethod
    def log_data_accessed(
        self,
        principal: Address,
        fiduciary: Address,
        purpose: String,
        timestamp: UInt64,
        is_emergency: Bool,
    ) -> None:
        arc4.emit(DataAccessed(principal, fiduciary, purpose, timestamp, is_emergency))

    @arc4.abimethod
    def log_access_requested(
        self,
        principal: Address,
        fiduciary: Address,
        purpose: String,
        timestamp: UInt64,
    ) -> None:
        arc4.emit(AccessRequested(principal, fiduciary, purpose, timestamp))

    @arc4.abimethod
    def log_erasure_requested(
        self,
        principal: Address,
        timestamp: UInt64,
    ) -> None:
        arc4.emit(ErasureRequested(principal, timestamp))

