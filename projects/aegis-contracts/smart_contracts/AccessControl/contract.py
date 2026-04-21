from algopy import ARC4Contract, GlobalState, LocalState, Txn, arc4
from algopy.arc4 import Address


class AccessControl(ARC4Contract):
    def __init__(self) -> None:
        # RGXCDITOJF7HQR5KOVUXNQNEDBWTN4UQFHIEJZTZQLIN2CMNET22FZYJWQ
        self.super_admin = GlobalState(Address("RGXCDITOJF7HQR5KOVUXNQNEDBWTN4UQFHIEJZTZQLIN2CMNET22FZYJWQ"), key="super_admin")
        self.admins = LocalState(arc4.Bool, key="admins")

    @arc4.abimethod(create="require")
    def initialize(self) -> None:
        """Called only on contract creation."""
        # Hardcoded super admin
        self.super_admin.value = Address("RGXCDITOJF7HQR5KOVUXNQNEDBWTN4UQFHIEJZTZQLIN2CMNET22FZYJWQ")

    @arc4.abimethod(allow_actions=["OptIn"])
    def opt_in(self) -> None:
        """Accounts must opt in to use local state."""
        self.admins[Txn.sender] = arc4.Bool(Txn.sender == self.super_admin.value)

    @arc4.abimethod
    def add_admin(self, admin: Address) -> None:
        assert self.admins[Txn.sender] == arc4.Bool(True), "Not admin"
        self.admins[admin.native] = arc4.Bool(True)

    @arc4.abimethod
    def remove_admin(self, admin: Address) -> None:
        assert self.admins[Txn.sender] == arc4.Bool(True), "Not admin"
        self.admins[admin.native] = arc4.Bool(False)
