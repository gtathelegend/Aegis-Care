from algopy import (
    ARC4Contract,
    GlobalState,
    BoxMap,
    Txn,
    arc4,
)
from algopy import subroutine

# Role Bitmasks:
# 1: Hospital (bit 0)
# 2: Doctor (bit 1)
# 4: Lab (bit 2)
# 8: Pharmacy (bit 3)
# 16: Insurance (bit 4)
# 32: Auditor (bit 5)
# Note: Admin is handled separately via the is_admin method.

class HealthcareRBAC(ARC4Contract):

    def __init__(self) -> None:
        # Hardcoded Admin: ZB4FKAVJU6E3ANTCSPPA5PSSIA35XUUA4O2GASDKZVDLUNZ4DMPLYJMVKM
        admin_addr = arc4.Address("ZB4FKAVJU6E3ANTCSPPA5PSSIA35XUUA4O2GASDKZVDLUNZ4DMPLYJMVKM")
        
        self.initial_admin = GlobalState(arc4.Address, key="init_admin")
        self.initial_admin.value = admin_addr

        # BoxMap: address -> bool (is admin)
        self.admins = BoxMap(arc4.Address, arc4.Bool, key_prefix=b"adm_")

        # BoxMap: address -> uint8 (role)
        self.roles = BoxMap(arc4.Address, arc4.UInt8, key_prefix=b"role_")

    @arc4.abimethod
    def add_admin(self, new_admin: arc4.Address) -> None:
        """Only the initial admin or existing admins can add new admins."""
        self._only_admin()
        self.admins[new_admin] = arc4.Bool(True)

    @arc4.abimethod(readonly=True)
    def is_admin(self, wallet: arc4.Address) -> arc4.Bool:
        """Returns True if the wallet is an admin."""
        if wallet == self.initial_admin.value:
            return arc4.Bool(True)
        if wallet in self.admins:
            return self.admins[wallet]
        return arc4.Bool(False)

    @arc4.abimethod
    def register_role(self, user: arc4.Address, role: arc4.UInt8) -> None:
        """Admins can register any role. Hospitals(bit 1) can register Doctors(bit 2) and Labs(bit 4)."""
        caller_role = self.get_role(arc4.Address(Txn.sender))
        caller_is_admin = self.is_admin(arc4.Address(Txn.sender))
        
        valid_caller = caller_is_admin.native or (
            (caller_role.native & 1) != 0 and (role.native == 2 or role.native == 4)
        )
        assert valid_caller, "Unauthorized to assign this role"
        
        assert role.native > 0, "Invalid role"
        
        self.roles[user] = role
        arc4.emit("RoleAssigned(address,uint8)", user, role)

    @arc4.abimethod
    def update_role(self, user: arc4.Address, role: arc4.UInt8) -> None:
        """Only admins can arbitrarily update a role for a user."""
        self._only_admin()
        assert role.native > 0, "Invalid role"
        self.roles[user] = role
        arc4.emit("RoleUpdated(address,uint8)", user, role)

    @arc4.abimethod(readonly=True)
    def get_role(self, wallet: arc4.Address) -> arc4.UInt8:
        """Returns the role bitmask of a wallet (0 if not set)."""
        if wallet in self.roles:
            return self.roles[wallet]
        return arc4.UInt8(0)

    @subroutine
    def _only_admin(self) -> None:
        """Internal check: caller must be an admin."""
        caller = arc4.Address(Txn.sender)
        assert self.is_admin(caller).native, "Only admin allowed"
