<?php

namespace App\Enums;

enum UatApproverMode: string
{
    case EXTERNAL_LINK = 'external_link';
    case INTERNAL_ACCOUNT = 'internal_account';
}
