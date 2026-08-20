<?php

namespace App\Enums;

enum UatApprovalStatus: string
{
    case PENDING = 'pending';
    case APPROVED = 'approved';
    case REJECTED = 'rejected';
    case REVOKED = 'revoked';
}
