<?php

namespace App\Enums;

enum UatApprovalRoundStatus: string
{
    case ACTIVE = 'active';
    case COMPLETED = 'completed';
    case SUPERSEDED = 'superseded';
}
