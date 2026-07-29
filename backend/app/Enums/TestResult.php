<?php

namespace App\Enums;

enum TestResult: string
{
    case PASS = 'pass';
    case FAIL = 'fail';
    case CONDITIONAL_PASS = 'conditional_pass';
}
