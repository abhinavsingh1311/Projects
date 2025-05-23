﻿// <auto-generated> This file has been auto generated by EF Core Power Tools. </auto-generated>
#nullable disable
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ServicingSystem.Entities;

[Table("JobDetail")]
internal partial class JobDetail
{
    [Key]
    [Column("JobDetailID")]
    public int JobDetailId { get; set; }

    [Column("JobID")]
    public int JobId { get; set; }

    [Required]
    [StringLength(100)]
    public string Description { get; set; }

    [Column(TypeName = "decimal(5, 2)")]
    public decimal JobHours { get; set; }

    public string Comments { get; set; }

    [Column("CouponID")]
    public int? CouponId { get; set; }

    [Required]
    [StringLength(1)]
    [Unicode(false)]
    public string StatusCode { get; set; }

    [Column("EmployeeID")]
    [StringLength(450)]
    public string EmployeeId { get; set; }

    public bool RemoveFromViewFlag { get; set; }

    [ForeignKey("CouponId")]
    [InverseProperty("JobDetails")]
    public virtual Coupon Coupon { get; set; }

    [ForeignKey("JobId")]
    [InverseProperty("JobDetails")]
    public virtual Job Job { get; set; }
}